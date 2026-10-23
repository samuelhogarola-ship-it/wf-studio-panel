import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const sourceExtensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']
const runtimeExtensionSubstitutions = new Map([
  ['.js', ['.ts', '.tsx', '.js', '.jsx']],
  ['.jsx', ['.tsx', '.jsx']],
  ['.mjs', ['.mts', '.mjs']],
  ['.cjs', ['.cts', '.cjs']],
])

function posix(value) {
  return value.split(path.sep).join('/')
}

function sourceFiles(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(absolute)
    return sourceExtensions.includes(path.extname(entry.name)) ? [absolute] : []
  })
}

function isStrictlyWithin(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
}

function containsNodeModules(root, candidate) {
  return path.relative(root, candidate).split(path.sep).includes('node_modules')
}

function resolveLocalModule(specifier, importer, sourceRoot) {
  const base = specifier.startsWith('@/')
    ? path.join(sourceRoot, specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(importer), specifier)
      : null
  if (!base) return null
  const runtimeExtension = runtimeExtensionSubstitutions.get(path.extname(base))
  const candidates = runtimeExtension
    ? runtimeExtension.map(extension => `${base.slice(0, -path.extname(base).length)}${extension}`)
    : path.extname(base)
      ? [base]
      : [
          ...sourceExtensions.map(extension => `${base}${extension}`),
          ...sourceExtensions.map(extension => path.join(base, `index${extension}`)),
        ]
  const realSourceRoot = realpathSync(sourceRoot)
  for (const rawCandidate of candidates) {
    const candidate = path.resolve(rawCandidate)
    if (!isStrictlyWithin(sourceRoot, candidate) || containsNodeModules(sourceRoot, candidate)) continue
    if (!existsSync(candidate) || !statSync(candidate).isFile()) continue
    const realCandidate = realpathSync(candidate)
    if (!isStrictlyWithin(realSourceRoot, realCandidate) || containsNodeModules(realSourceRoot, realCandidate)) continue
    return realCandidate
  }
  return null
}

function parseSource(file) {
  const extension = path.extname(file)
  const scriptKind = extension === '.tsx' ? ts.ScriptKind.TSX
    : extension === '.jsx' ? ts.ScriptKind.JSX
      : extension === '.js' || extension === '.mjs' || extension === '.cjs' ? ts.ScriptKind.JS
        : ts.ScriptKind.TS
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, scriptKind)
}

function hasModifier(node, kind) {
  return node.modifiers?.some(modifier => modifier.kind === kind) ?? false
}

function isServerActionModule(sourceFile) {
  return sourceFile.statements.some(statement => ts.isExpressionStatement(statement)
    && ts.isStringLiteral(statement.expression)
    && statement.expression.text === 'use server')
}

function runtimeExports(sourceFile, file, sourceRoot, seen = new Set()) {
  const names = new Set()
  const visited = new Set(seen).add(file)
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) names.add('default')
      else if (statement.name) names.add(statement.name.text)
    }
    if (ts.isVariableStatement(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text)
      }
    }
    if (ts.isExportAssignment(statement)) names.add('default')
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly
      && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        if (!element.isTypeOnly) names.add(element.name.text)
      }
    }
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly && !statement.exportClause
      && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      const resolved = resolveLocalModule(statement.moduleSpecifier.text, file, sourceRoot)
      if (resolved && !visited.has(resolved)) {
        for (const name of runtimeExports(parseSource(resolved), resolved, sourceRoot, visited)) {
          if (name !== 'default') names.add(name)
        }
      }
    }
  }
  return names
}

function staticDependencies(sourceFile) {
  const dependencies = []
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const names = new Set()
      const clause = statement.importClause
      if (clause?.isTypeOnly) continue
      if (clause?.name) names.add('default')
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          if (!element.isTypeOnly) names.add((element.propertyName ?? element.name).text)
        }
      }
      if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) names.add('*')
      if (!clause || names.size > 0) dependencies.push(statement.moduleSpecifier.text)
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      if (statement.isTypeOnly) continue
      const names = new Set()
      if (!statement.exportClause) names.add('*')
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          if (!element.isTypeOnly) names.add((element.propertyName ?? element.name).text)
        }
      }
      if (statement.exportClause && ts.isNamespaceExport(statement.exportClause)) names.add('*')
      if (names.size > 0) dependencies.push(statement.moduleSpecifier.text)
    }
  }
  return dependencies
}

function dynamicDependencies(sourceFile) {
  const dependencies = []
  function inspect(node) {
    if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) dependencies.push(node.arguments[0].text)
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') dependencies.push(node.arguments[0].text)
    }
    ts.forEachChild(node, inspect)
  }
  inspect(sourceFile)
  return dependencies
}

function unwrapExpression(node) {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)
    || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) return unwrapExpression(node.expression)
  return node
}

function lexicalScope(node) {
  let current = node.parent
  while (current && !ts.isSourceFile(current) && !ts.isBlock(current)) current = current.parent
  return current
}

function constBindings(sourceFile) {
  const bindings = new Map()
  function inspect(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const)) {
      const scope = lexicalScope(node)
      if (scope) {
        const entries = bindings.get(node.name.text) ?? []
        entries.push({ declaration: node, initializer: node.initializer, scope })
        bindings.set(node.name.text, entries)
      }
    }
    ts.forEachChild(node, inspect)
  }
  inspect(sourceFile)
  return bindings
}

function constInitializer(identifier, bindings) {
  const position = identifier.getStart()
  return (bindings.get(identifier.text) ?? [])
    .filter(binding => binding.declaration.getStart() < position
      && binding.scope.getStart() <= position && binding.scope.getEnd() >= position)
    .sort((left, right) => right.scope.getStart() - left.scope.getStart()
      || right.declaration.getStart() - left.declaration.getStart())[0] ?? null
}

function resolvedExpression(node, bindings, seen = new Set()) {
  const expression = unwrapExpression(node)
  if (!ts.isIdentifier(expression)) return expression
  const binding = constInitializer(expression, bindings)
  if (!binding || seen.has(binding.declaration)) return expression
  const nextSeen = new Set(seen).add(binding.declaration)
  return resolvedExpression(binding.initializer, bindings, nextSeen)
}

function staticText(node, bindings, seen = new Set()) {
  const expression = unwrapExpression(node)
  if (ts.isIdentifier(expression)) {
    const binding = constInitializer(expression, bindings)
    if (!binding || seen.has(binding.declaration)) return null
    return staticText(binding.initializer, bindings, new Set(seen).add(binding.declaration))
  }
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text
  if (ts.isTemplateExpression(expression)) {
    let value = expression.head.text
    for (const span of expression.templateSpans) {
      const spanValue = staticText(span.expression, bindings, new Set(seen))
      if (spanValue === null) return null
      value += spanValue + span.literal.text
    }
    return value
  }
  return null
}

function jsxAttribute(opening, name, bindings) {
  const attribute = opening.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.text === name)
  if (!attribute || !ts.isJsxAttribute(attribute)) return { present: false, value: null }
  if (!attribute.initializer) return { present: true, value: null }
  if (ts.isStringLiteral(attribute.initializer)) return { present: true, value: attribute.initializer.text }
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
    return { present: true, value: staticText(attribute.initializer.expression, bindings) }
  }
  return { present: true, value: null }
}

function propertyName(node, bindings) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text
  return ts.isComputedPropertyName(node) ? staticText(node.expression, bindings) : null
}

function objectProperty(object, name, bindings, seenObjects = new Set()) {
  if (seenObjects.has(object)) return { present: false, resolved: false, value: null }
  const seen = new Set(seenObjects).add(object)
  for (const property of [...object.properties].reverse()) {
    if (ts.isPropertyAssignment(property) && propertyName(property.name, bindings) === name) {
      const value = staticText(property.initializer, bindings)
      return { present: true, resolved: value !== null, value }
    }
    if (ts.isShorthandPropertyAssignment(property) && property.name.text === name) {
      const value = staticText(property.name, bindings)
      return { present: true, resolved: value !== null, value }
    }
    if (ts.isSpreadAssignment(property)) {
      const spread = resolvedExpression(property.expression, bindings)
      if (!ts.isObjectLiteralExpression(spread)) return { present: false, resolved: false, value: null }
      const nested = objectProperty(spread, name, bindings, seen)
      if (nested.present || !nested.resolved) return nested
    }
  }
  return { present: false, resolved: true, value: null }
}

function fetchCall(node) {
  if (ts.isIdentifier(node.expression)) return node.expression.text === 'fetch'
  return ts.isPropertyAccessExpression(node.expression)
    && node.expression.name.text === 'fetch'
    && ts.isIdentifier(node.expression.expression)
    && ['window', 'globalThis', 'global'].includes(node.expression.expression.text)
}

function mutationRoutes(sourceFile, source) {
  const routes = []
  const dynamicMutations = []
  const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
  const bindings = constBindings(sourceFile)
  function add(method, route) {
    const normalizedMethod = method?.toUpperCase()
    if (!normalizedMethod || !mutationMethods.has(normalizedMethod) || !route) return
    routes.push({ id: `${normalizedMethod} ${route}`, method: normalizedMethod, route, source })
  }
  function addDynamic(node, kind, reason) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    const id = `DYNAMIC ${kind} ${source}:${line + 1}:${character + 1}`
    dynamicMutations.push({ id, kind, reason, source, line: line + 1, column: character + 1 })
  }
  function analyze(method, route, node, kind) {
    if (method === null) {
      addDynamic(node, kind, 'method')
      return
    }
    const normalizedMethod = method.toUpperCase()
    if (!mutationMethods.has(normalizedMethod)) return
    if (route === null) {
      addDynamic(node, kind, 'url')
      return
    }
    add(normalizedMethod, route)
  }
  function inspect(node) {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      if (node.tagName.getText(sourceFile) === 'form') {
        const method = jsxAttribute(node, 'method', bindings)
        const route = jsxAttribute(node, 'action', bindings)
        if (method.present) analyze(method.value, route.value, node, 'form')
      }
      const formMethod = jsxAttribute(node, 'formMethod', bindings)
      const formRoute = jsxAttribute(node, 'formAction', bindings)
      if (formMethod.present) analyze(formMethod.value, formRoute.value, node, 'form')
    }
    if (ts.isCallExpression(node) && fetchCall(node)) {
      const route = node.arguments[0] ? staticText(node.arguments[0], bindings) : null
      const options = node.arguments[1]
      if (!options) return
      const resolvedOptions = resolvedExpression(options, bindings)
      if (!ts.isObjectLiteralExpression(resolvedOptions)) {
        addDynamic(node, 'fetch', 'options')
        return
      }
      const method = objectProperty(resolvedOptions, 'method', bindings)
      if (!method.resolved) {
        addDynamic(node, 'fetch', method.present ? 'method' : 'options')
        return
      }
      if (method.present) analyze(method.value, route, node, 'fetch')
    }
    ts.forEachChild(node, inspect)
  }
  inspect(sourceFile)
  return { routes, dynamicMutations }
}

export function inventoryClientMutations({ projectRoot = process.cwd(), sourceRoot = 'src', entryDir = 'src/app/cliente' } = {}) {
  const absoluteRoot = realpathSync(path.resolve(projectRoot))
  const absoluteSourceRoot = realpathSync(path.resolve(absoluteRoot, sourceRoot))
  const entries = sourceFiles(path.resolve(absoluteRoot, entryDir))
  const visited = new Set()
  const actions = new Map()
  const routes = new Map()
  const dynamicMutations = new Map()

  function visit(file) {
    const absolute = realpathSync(path.resolve(file))
    if (!isStrictlyWithin(absoluteSourceRoot, absolute) || containsNodeModules(absoluteSourceRoot, absolute)) return
    if (visited.has(absolute)) return
    visited.add(absolute)
    const sourceFile = parseSource(absolute)
    if (isServerActionModule(sourceFile)) {
      const available = runtimeExports(sourceFile, absolute, absoluteSourceRoot)
      const module = posix(path.relative(absoluteRoot, absolute))
      for (const exportName of available) actions.set(`${module}#${exportName}`, { id: `${module}#${exportName}`, module, exportName })
      return
    }
    const source = posix(path.relative(absoluteRoot, absolute))
    const mutations = mutationRoutes(sourceFile, source)
    for (const route of mutations.routes) routes.set(`${route.id}#${route.source}`, route)
    for (const surface of mutations.dynamicMutations) dynamicMutations.set(surface.id, surface)
    for (const dependency of [...staticDependencies(sourceFile), ...dynamicDependencies(sourceFile)]) {
      const resolved = resolveLocalModule(dependency, absolute, absoluteSourceRoot)
      if (resolved) visit(resolved)
    }
  }

  for (const entry of entries) visit(entry)
  return {
    files: [...visited].map(file => posix(path.relative(absoluteRoot, file))).sort(),
    actions: [...actions.values()].sort((left, right) => left.id.localeCompare(right.id)),
    routes: [...routes.values()].sort((left, right) => left.id.localeCompare(right.id) || left.source.localeCompare(right.source)),
    dynamicMutations: [...dynamicMutations.values()].sort((left, right) => left.id.localeCompare(right.id)),
  }
}
