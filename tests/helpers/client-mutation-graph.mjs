import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']

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

function resolveLocalModule(specifier, importer, sourceRoot) {
  const base = specifier.startsWith('@/')
    ? path.join(sourceRoot, specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(importer), specifier)
      : null
  if (!base) return null
  const candidates = [
    ...sourceExtensions.map(extension => `${base}${extension}`),
    ...sourceExtensions.map(extension => path.join(base, `index${extension}`)),
    ...(sourceExtensions.includes(path.extname(base)) ? [base] : []),
  ]
  return candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile() && !path.extname(candidate).endsWith('.map')) ?? null
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

function runtimeExports(sourceFile) {
  const names = new Set()
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
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) names.add(element.name.text)
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
      dependencies.push({ specifier: statement.moduleSpecifier.text, names })
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
      dependencies.push({ specifier: statement.moduleSpecifier.text, names })
    }
  }
  return dependencies
}

function dynamicDependencies(sourceFile) {
  const dependencies = []
  function inspect(node) {
    if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) dependencies.push({ specifier: node.arguments[0].text, names: new Set(['*']) })
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') dependencies.push({ specifier: node.arguments[0].text, names: new Set(['*']) })
    }
    ts.forEachChild(node, inspect)
  }
  inspect(sourceFile)
  return dependencies
}

function expressionName(node) {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isPropertyAccessExpression(node)) {
    const parent = expressionName(node.expression)
    return parent ? `${parent}${node.name.text[0]?.toUpperCase() ?? ''}${node.name.text.slice(1)}` : node.name.text
  }
  if (ts.isElementAccessExpression(node) && node.argumentExpression) return expressionName(node.argumentExpression)
  if (ts.isCallExpression(node) && node.arguments[0]) return expressionName(node.arguments[0])
  return 'param'
}

function staticText(node) {
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)
    || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) return staticText(node.expression)
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map(span => `[${expressionName(span.expression)}]${span.literal.text}`).join('')
  }
  return null
}

function jsxAttribute(opening, name) {
  const attribute = opening.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.text === name)
  if (!attribute || !ts.isJsxAttribute(attribute) || !attribute.initializer) return null
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) return staticText(attribute.initializer.expression)
  return null
}

function objectProperty(object, name) {
  const property = object.properties.find(candidate => ts.isPropertyAssignment(candidate)
    && ((ts.isIdentifier(candidate.name) || ts.isStringLiteral(candidate.name)) && candidate.name.text === name))
  return property && ts.isPropertyAssignment(property) ? staticText(property.initializer) : null
}

function mutationRoutes(sourceFile, source) {
  const routes = []
  const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
  function add(method, route) {
    const normalizedMethod = method?.toUpperCase()
    if (!normalizedMethod || !mutationMethods.has(normalizedMethod) || !route?.startsWith('/')) return
    routes.push({ id: `${normalizedMethod} ${route}`, method: normalizedMethod, route, source })
  }
  function inspect(node) {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      if (node.tagName.getText(sourceFile) === 'form') add(jsxAttribute(node, 'method'), jsxAttribute(node, 'action'))
      add(jsxAttribute(node, 'formMethod'), jsxAttribute(node, 'formAction'))
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'fetch') {
      const route = node.arguments[0] ? staticText(node.arguments[0]) : null
      const options = node.arguments[1]
      const method = options && ts.isObjectLiteralExpression(options) ? objectProperty(options, 'method') : null
      add(method, route)
    }
    ts.forEachChild(node, inspect)
  }
  inspect(sourceFile)
  return routes
}

export function inventoryClientMutations({ projectRoot = process.cwd(), sourceRoot = 'src', entryDir = 'src/app/cliente' } = {}) {
  const absoluteRoot = path.resolve(projectRoot)
  const absoluteSourceRoot = path.resolve(absoluteRoot, sourceRoot)
  const entries = sourceFiles(path.resolve(absoluteRoot, entryDir))
  const visited = new Set()
  const actions = new Map()
  const routes = new Map()

  function visit(file, requestedNames = new Set(['*'])) {
    const absolute = path.resolve(file)
    const sourceFile = parseSource(absolute)
    if (isServerActionModule(sourceFile)) {
      const available = runtimeExports(sourceFile)
      const selected = requestedNames.has('*') ? available : new Set([...requestedNames].filter(name => available.has(name)))
      const module = posix(path.relative(absoluteRoot, absolute))
      for (const exportName of selected) actions.set(`${module}#${exportName}`, { id: `${module}#${exportName}`, module, exportName })
      return
    }
    if (visited.has(absolute)) return
    visited.add(absolute)
    const source = posix(path.relative(absoluteRoot, absolute))
    for (const route of mutationRoutes(sourceFile, source)) routes.set(`${route.id}#${route.source}`, route)
    for (const dependency of [...staticDependencies(sourceFile), ...dynamicDependencies(sourceFile)]) {
      const resolved = resolveLocalModule(dependency.specifier, absolute, absoluteSourceRoot)
      if (resolved) visit(resolved, dependency.names)
    }
  }

  for (const entry of entries) visit(entry)
  return {
    files: [...visited].map(file => posix(path.relative(absoluteRoot, file))).sort(),
    actions: [...actions.values()].sort((left, right) => left.id.localeCompare(right.id)),
    routes: [...routes.values()].sort((left, right) => left.id.localeCompare(right.id) || left.source.localeCompare(right.source)),
  }
}
