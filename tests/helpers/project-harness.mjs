import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import React from 'react';

const root = path.resolve(import.meta.dirname, '../..');
const require = createRequire(import.meta.url);

// Run the actual TS/TSX modules; replace only Next request boundaries and remote DB I/O.
export function loadProjectModule(relative, overrides = {}) {
  const modules = new Map();
  const mocks = {
    'server-only': {},
    'next/cache': { revalidatePath() {} },
    'next/navigation': { notFound() { throw new Error('404'); }, redirect(url) { throw new Error(`redirect:${url}`); } },
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children), __esModule: true },
    '@/lib/locale': { getLocale: async () => 'es' },
    '@/components/layout/app-shell': { AdminShell: ({ children, title }) => React.createElement('main', null, React.createElement('h1', null, title), children) },
    ...overrides,
  };
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const source = readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    }, fileName: filename }).outputText;
    const module = { exports: {} };
    modules.set(filename, module);
    function localRequire(specifier) {
      if (specifier in mocks) return mocks[specifier];
      if (specifier.startsWith('@/') || specifier.startsWith('.')) {
        const base = specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        const target = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
        if (target?.endsWith('.ts') || target?.endsWith('.tsx')) return load(target);
        return require(target ?? base);
      }
      return require(specifier);
    }
    new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
    return module.exports;
  }
  return load(path.join(root, relative));
}

export const projectId = '11111111-1111-4111-8111-111111111111';
export const clientId = '22222222-2222-4222-8222-222222222222';
export const otherClientId = '33333333-3333-4333-8333-333333333333';
const projectCapabilityKeys = ['products', 'domains', 'hosting', 'invoices', 'bonuses_reports', 'blogger', 'analytics'];
export const client = { id: clientId, name: 'Ana', email: 'ana@example.com', status: 'active', project: 'wf-studio', portal_mode: 'legacy' };
export const project = { id: projectId, client_id: clientId, slug: 'example', name: 'Example', domain: 'example.com', status: 'active', client_access_enabled: true, hosting_label: 'Managed', hosting_management_url: null, analytics_registry_key: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
export const capability = { id: '44444444-4444-4444-8444-444444444444', project_id: projectId, capability_key: 'blogger', state: 'available', launch_url: null, metadata: {}, validated_at: null, created_at: project.created_at, updated_at: project.updated_at };
export function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
}

export function database(seed = {}, failures = {}, { beforeExecute } = {}) {
  const tables = structuredClone({ admin_project_favorites: [], clients: [client], client_projects: [project], project_capabilities: [capability], project_capability_audit: [], ...seed });
  const calls = [];
  return { tables, calls, from(table) {
    const call = { table, operation: 'select', filters: [], payload: null };
    calls.push(call);
    let single = false;
    let limit;
    let ordering;
    let range;
    let countRequested = false;
    const query = {
      select(_columns, options) { countRequested = options?.count === 'exact'; return query; },
      eq(key, value) { call.filters.push(row => row[key] === value); return query; },
      neq(key, value) { call.filters.push(row => row[key] !== value); return query; },
      is(key, value) { call.filters.push(row => row[key] === value); return query; },
      ilike(key, value) { call.filters.push(row => row[key]?.toLowerCase() === value.toLowerCase()); return query; },
      in(key, values) { call.filters.push(row => values.includes(row[key])); return query; },
      order(key, options) { ordering = [key, options?.ascending !== false]; return query; },
      limit(value) { limit = value; return query; },
      range(from, to) { range = [from, to]; return query; },
      maybeSingle() { single = true; return query; },
      single() { single = true; return query; },
      insert(payload) { call.operation = 'insert'; call.payload = payload; return query; },
      update(payload) { call.operation = 'update'; call.payload = payload; return query; },
      upsert(payload, options) { call.operation = 'upsert'; call.payload = payload; call.conflict = options?.onConflict; return query; },
      delete() { call.operation = 'delete'; return query; },
      async then(resolve, reject) {
        try {
          await beforeExecute?.(call);
          if (failures[table]) return Promise.resolve({ data: null, error: { message: failures[table] } }).then(resolve, reject);
          let rows = (tables[table] ?? []).filter(row => call.filters.every(filter => filter(row)));
          if (call.operation === 'update') rows.forEach(row => {
            Object.assign(row, call.payload);
            // Mirrors the project's existing BEFORE UPDATE timestamp trigger.
            if (table === 'client_projects') row.updated_at = new Date(Date.parse(row.updated_at ?? project.updated_at) + 1).toISOString();
          });
          if (call.operation === 'delete') {
            tables[table] = (tables[table] ?? []).filter(row => !call.filters.every(filter => filter(row)));
          }
          if (['insert', 'upsert'].includes(call.operation)) {
            rows = (Array.isArray(call.payload) ? call.payload : [call.payload]).map(payload => {
              const existing = call.operation === 'upsert' && (tables[table] ?? []).find(row => (call.conflict ?? 'id').split(',').every(key => row[key] === payload[key]));
              if (existing) return Object.assign(existing, payload);
              const row = { id: projectId, ...payload };
              (tables[table] ??= []).push(row);
              // Mirrors the database's AFTER INSERT project capability trigger.
              if (table === 'client_projects' && call.operation === 'insert') {
                for (const capabilityKey of projectCapabilityKeys) {
                  if ((tables.project_capabilities ?? []).some(capability => capability.project_id === row.id && capability.capability_key === capabilityKey)) continue;
                  (tables.project_capabilities ??= []).push({
                    id: `default-${capabilityKey}`,
                    project_id: row.id,
                    capability_key: capabilityKey,
                    state: 'unavailable',
                    launch_url: null,
                    metadata: {},
                    validated_at: null,
                    created_at: row.created_at ?? project.created_at,
                    updated_at: row.updated_at ?? project.updated_at,
                  });
                }
              }
              return row;
            });
          }
          if (ordering) rows.sort((a, b) => String(a[ordering[0]]).localeCompare(String(b[ordering[0]])) * (ordering[1] ? 1 : -1));
          const count = countRequested ? rows.length : null;
          if (limit !== undefined) rows = rows.slice(0, limit);
          if (range) rows = rows.slice(range[0], range[1] + 1);
          if (single && rows.length > 1) return Promise.resolve({ data: null, error: { message: 'Multiple rows for a single result' } }).then(resolve, reject);
          return Promise.resolve({ data: structuredClone(single ? rows[0] ?? null : rows), error: null, count }).then(resolve, reject);
        } catch (error) { return Promise.reject(error).then(resolve, reject); }
      },
    };
    return query;
  } };
}

export function boundary(db, extra = {}) {
  const events = [];
  const identity = { userId: 'admin-id', email: 'admin@example.com' };
  return { events, mocks: {
    '@/lib/auth': { requireAdmin: async () => { events.push('admin'); return identity; }, requireClientAccess: async () => ({ ...identity, client }) },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => { events.push('session-db'); return db; } },
    '@/lib/supabase/admin': { getSupabaseAdminClient() { throw new Error('Service-role access forbidden'); } },
    ...extra,
  } };
}
