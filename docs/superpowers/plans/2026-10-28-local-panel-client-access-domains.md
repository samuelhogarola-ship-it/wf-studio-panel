# Local Panel, Client Access and Domains Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar WF Panel listo para trabajo local y corregir el alta con contraseña y el acceso rápido a dominios por cliente.

**Architecture:** Mantener Supabase como backend aislado local, corregir el contrato de proyectos en una migración aditiva y reutilizar `packs` para dominios. La acción de alta directa delegará la coordinación sensible en una función pequeña y comprobable.

**Tech Stack:** Next.js 15, TypeScript, Node test runner, Supabase/PostgreSQL, Colima/Docker.

**Spec:** `docs/superpowers/specs/2026-10-28-local-panel-client-access-domains-design.md`

## Global Constraints

- No modificar ni borrar las tres copias legacy.
- No usar credenciales ni datos de producción para el entorno local.
- No duplicar el contrato de dominios fuera de `packs`.
- Escribir y observar fallar cada prueba antes del código de producción.

## Review Focus

- Emails con mayúsculas deben normalizarse antes de Auth y base de datos.
- Un fallo de inserción del cliente debe limpiar el usuario Auth recién creado.
- Los errores de duplicado no deben exponer mensajes internos de Supabase.
- El cliente preseleccionado no debe sobrescribir el cliente de un pack que se está editando.
- La nueva restricción de proyecto debe conservar todos los valores previamente válidos.

---

### Task 1: Contrato de proyectos de cliente

**Files:**
- Create: `supabase/migrations/202610280001_clients_project_values.sql`
- Test: `tests/client-project-values.test.mjs`

**Interfaces:**
- Produces: restricción `clients_project_check` con los cuatro valores de `PROJECT_VALUES`.

- [ ] Escribir una prueba que exija `vivir-fuengirola-negocios` y los tres valores existentes.
- [ ] Ejecutar la prueba y comprobar que falla.
- [ ] Añadir la migración aditiva.
- [ ] Ejecutar la prueba y comprobar que pasa.

### Task 2: Alta directa robusta

**Files:**
- Create: `src/lib/clients/direct-create.mjs`
- Create: `src/lib/clients/direct-create-module.d.ts`
- Modify: `src/lib/actions/admin.ts`
- Test: `tests/client-direct-create.test.mjs`

**Interfaces:**
- Produces: `createClientWithPassword({ name, email, password, project, createAuthUser, insertClient, deleteAuthUser })`.
- Consumes: callbacks de Supabase inyectados desde la acción de servidor.

- [ ] Escribir pruebas de normalización, éxito, error Auth, duplicado de cliente y cleanup.
- [ ] Ejecutarlas y comprobar que fallan por módulo ausente.
- [ ] Implementar la función mínima y conectarla a la acción.
- [ ] Ejecutar las pruebas y la suite completa.

### Task 3: Alta de dominio desde cliente

**Files:**
- Modify: `src/components/admin/pack-form.tsx`
- Modify: `src/app/paneladmin/(protected)/bonos/page.tsx`
- Modify: `src/app/paneladmin/(protected)/clientes/[id]/page.tsx`
- Test: `tests/client-domain-shortcut.test.mjs`

**Interfaces:**
- Produces: `PackForm.defaultClientId?: string` y enlace `/paneladmin/bonos?new=1&tab=dominios&client=<uuid>`.

- [ ] Escribir la prueba del enlace y la precedencia edición/preselección.
- [ ] Ejecutarla y comprobar que falla.
- [ ] Implementar los parámetros y la acción visible.
- [ ] Ejecutar la prueba y la suite completa.

### Task 4: Entorno local reproducible

**Files:**
- Create: `scripts/setup-local.mjs`
- Modify: `package.json`
- Modify: `README.md`
- Test: `tests/local-setup.test.mjs`

**Interfaces:**
- Produces: `npm run setup:local`, que valida el runtime de contenedores, arranca Supabase y genera `.env.local` ignorado por Git.

- [ ] Escribir pruebas del generador de configuración sin secretos reales.
- [ ] Ejecutarlas y comprobar que fallan.
- [ ] Implementar el bootstrap y documentar clientes, dominios y facturas.
- [ ] Instalar/iniciar Colima y ejecutar el bootstrap real.
- [ ] Ejecutar `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`.
