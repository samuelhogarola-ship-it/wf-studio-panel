# Platform Request Inboxes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recibir solicitudes públicas de Vivir en Fuengirola y Conoce Fuengirola en tres bandejas aisladas, revisarlas en WF Panel y convertirlas de forma segura en clientes del CRM.

**Architecture:** Una tabla central `platform_requests` conserva la ficha y su auditoría; una API pública validada es la única entrada anónima; una función SQL transaccional aprueba y enlaza el cliente sin carreras. Las páginas administrativas reutilizan una capa de datos y acciones específicas, filtradas siempre por plataforma.

**Tech Stack:** Next.js App Router, React Server Components, TypeScript, Node test runner, Zod, Supabase/PostgreSQL RLS y Cloudflare Turnstile.

**Spec:** `docs/superpowers/specs/2026-10-29-platform-request-inboxes-design.md`

## Global Constraints

- Plataformas exactas: `vivir-fuengirola`, `vivir-fuengirola-negocios`, `conoce-fuengirola`.
- Tipos exactos: `client`, `business`, `subscription_interest`; `name` y `email` son obligatorios.
- Orígenes Vivir, con y sin `www`, solo pueden enviar a los dos ámbitos Vivir; los de Conoce solo a Conoce.
- El único origen local adicional procede de `PLATFORM_REQUEST_DEV_ORIGIN` y se ignora con `NODE_ENV='production'`.
- Cuerpo máximo 32 KiB; `profile` máximo 24 KiB, cinco niveles y cien claves; nombre 120, email 160, teléfono 80, empresa 160, mensaje 5.000 y URL 500 caracteres.
- Ningún formulario público escribe directamente en Supabase ni recibe una clave de servicio.
- Aprobar no crea Auth, contraseña, pack, factura, cobro ni suscripción.
- Las altas antiguas en `clients.status = 'pending'` siguen visibles durante la transición.
- No modificar los formularios públicos que está trabajando Claude; entregarles un contrato HTTP estable.
- Usar TDD, mantener los cambios dentro de esta rama y no aplicar migraciones remotas hasta que toda la verificación local pase.

## Review Focus

- Origen permitido con `platform` ajena o `sourceUrl` falsificada: responder 403/400 sin insertar ni reflejar CORS inseguro; lo cubre Task 2.
- Reintento, mayúsculas en email y dos solicitudes iguales: devolver `existing` y mantener una sola pendiente; lo cubren Tasks 1 y 2.
- Dos aprobaciones concurrentes para el mismo `project + lower(email)`: ambas terminan enlazadas al único cliente; lo cubre Task 1.
- `profile` no objeto, demasiado profundo o grande: responder `invalid_payload` antes de acceder a Supabase; lo cubre Task 2.
- Solicitud ya resuelta, RPC sin administrador o Turnstile parcial/fallido: fallar cerrado, sin cambios parciales ni secretos; lo cubren Tasks 1, 2 y 3.

---

### Task 1: Esquema, deduplicación y aprobación atómica

**Files:**
- Create: `supabase/migrations/202610290003_platform_requests.sql`
- Create: `tests/platform-requests-migration.test.mjs`

**Interfaces:**
- Produces: tabla `public.platform_requests`, enum-like checks, índice `platform_requests_pending_fingerprint_unique_idx`, función `public.approve_platform_request(p_request_id uuid)` que devuelve `(outcome text, client_id uuid)`, y función `public.reject_platform_request(p_request_id uuid, p_reason text)`.

- [ ] **Step 1: Escribir las pruebas de migración que exijan columnas, checks, FK, timestamps, RLS, política de lectura para `private.is_admin()`, ausencia de escritura `anon/authenticated`, índice único pendiente y permisos explícitos de RPC.**

- [ ] **Step 2: Añadir pruebas SQL estructurales para que la aprobación bloquee la solicitud, compruebe `pending`, use `clients_project_email_lower_unique_idx`, recupere el ganador tras conflicto, asigne el proyecto exacto, no sobrescriba clientes existentes y registre `reviewed_by/reviewed_at/converted_client_id`.**

- [ ] **Step 3: Ejecutar `node --test tests/platform-requests-migration.test.mjs` y verificar que falla porque la migración aún no existe.**

- [ ] **Step 4: Implementar la migración con `security definer`, `set search_path = ''`, comprobación interna de `private.is_admin()` y revocación de ejecución a `public/anon`; mantener el insert público fuera de cualquier RPC anónima.**

- [ ] **Step 5: Ejecutar la prueba dirigida y verificar `PASS` para duplicado pendiente, aprobación concurrente, solicitud resuelta y rechazo auditado.**

- [ ] **Step 6: Commit.**

```bash
git add supabase/migrations/202610290001_platform_requests.sql tests/platform-requests-migration.test.mjs
git commit -m "feat: add platform request workflow schema"
```

### Task 2: Contrato público seguro y rutas HTTP

**Files:**
- Create: `src/lib/platform-requests/public-api.mjs`
- Create: `src/types/platform-requests-public-api.d.ts`
- Create: `src/app/api/platform-requests/route.ts`
- Create: `src/app/api/platform-requests/config/route.ts`
- Create: `tests/platform-requests-api.test.mjs`
- Modify: `.env.example`

**Interfaces:**
- Consumes: insert de servicio sobre `public.platform_requests` de Task 1.
- Produces: `handlePlatformRequestOptions(request)`, `handlePlatformRequestConfigGet(request, options)`, `handlePlatformRequestPost(request, options)` y rutas `GET config`, `OPTIONS`, `POST`.
- `handlePlatformRequestPost` recibe por inyección `createRequest(payload)` y `verifyToken(token, remoteIp, secret): Promise<{ success: boolean; hostname?: string }>` para pruebas; la ruta real usa `getSupabaseAdminClient()`.

- [ ] **Step 1: Escribir pruebas para el mapeo exacto de los cuatro orígenes HTTPS, rechazo de origen desconocido, `platform` cruzada, `sourceUrl` de otro origen y CORS sin comodines.**

- [ ] **Step 2: Añadir pruebas para normalización de email, campos obligatorios, tipos permitidos, límites de strings, `profile` objeto con profundidad/tamaño acotados y honeypot sin inserción.**

- [ ] **Step 3: Añadir pruebas para Turnstile desactivado en desarrollo, obligatorio en producción, configuración parcial 503, hostname no coincidente, timeout y respuesta que nunca contiene secretos.**

- [ ] **Step 4: Añadir pruebas de idempotencia: `createRequest` devuelve `created` o `existing`; esperar HTTP 201/200 y los cuerpos exactos del spec.**

- [ ] **Step 5: Ejecutar `node --test tests/platform-requests-api.test.mjs` y verificar el fallo por módulo ausente.**

- [ ] **Step 6: Implementar en `public-api.mjs` el esquema Zod, origen→plataformas, validación de `sourceUrl`, fingerprint SHA-256 de `platform|requestType|lower(email)`, CORS, Turnstile y códigos de respuesta.**

- [ ] **Step 7: Implementar las rutas; el adaptador intenta `insert`, traduce `23505` consultando solo `id/status` por fingerprint pendiente y devuelve `existing`; no usa `upsert` contra el índice parcial y nunca expone filas.**

- [ ] **Step 8: Documentar en `.env.example` las claves Turnstile ya utilizadas por contacto y `PLATFORM_REQUEST_DEV_ORIGIN`, indicando que esta última solo actúa fuera de producción.**

- [ ] **Step 9: Ejecutar la prueba dirigida y verificar `PASS`.**

- [ ] **Step 10: Commit.**

```bash
git add .env.example src/lib/platform-requests/public-api.mjs src/types/platform-requests-public-api.d.ts src/app/api/platform-requests tests/platform-requests-api.test.mjs
git commit -m "feat: expose secure platform request API"
```

### Task 3: Lectura y mutaciones administrativas aisladas

**Files:**
- Create: `src/lib/platform-requests/admin.ts`
- Create: `src/lib/actions/platform-requests.ts`
- Create: `tests/platform-requests-admin.test.mjs`

**Interfaces:**
- Consumes: tabla y RPC de Task 1.
- Produces: `getPlatformRequestInbox(input: { platforms: PlatformRequestPlatform[]; status?: PlatformRequestStatus; query?: string; selectedId?: string })`, `getPendingPlatformRequestCounts()`, `approvePlatformRequestAction`, `rejectPlatformRequestAction`.

- [ ] **Step 1: Escribir pruebas de datos que exijan `requireAdmin`, filtro por plataforma antes de búsqueda/selección, orden descendente, contadores separados y ausencia de filas de otro ámbito.**

- [ ] **Step 2: Escribir pruebas de acciones: UUID y motivo validados, RPC correcta, mensajes para `created_client`, `existing_client` y solicitud ya resuelta, y revalidación de inicio, bandeja, lista y ficha resultante.**

- [ ] **Step 3: Ejecutar `node --test tests/platform-requests-admin.test.mjs` y verificar que falla por módulos ausentes.**

- [ ] **Step 4: Implementar tipos y consultas en `admin.ts`; seleccionar únicamente campos necesarios y mantener `profile_data` como objeto desconocido para renderizado seguro.**

- [ ] **Step 5: Implementar acciones en `platform-requests.ts` con `requireAdmin`, Zod, llamadas RPC y rutas determinadas por el `platform` leído, no por datos ocultos enviados desde el navegador.**

- [ ] **Step 6: Ejecutar la prueba dirigida y verificar `PASS`.**

- [ ] **Step 7: Commit.**

```bash
git add src/lib/platform-requests/admin.ts src/lib/actions/platform-requests.ts tests/platform-requests-admin.test.mjs
git commit -m "feat: add platform request admin operations"
```

### Task 4: Navegación contextual y bandejas por plataforma

**Files:**
- Create: `src/components/admin/platform-section-nav.tsx`
- Create: `src/components/admin/platform-request-inbox.tsx`
- Create: `src/app/paneladmin/(protected)/vivir-en-fuengirola/solicitudes/page.tsx`
- Create: `src/app/paneladmin/(protected)/conoce-fuengirola/solicitudes/page.tsx`
- Create: `tests/platform-request-inbox-ui.test.mjs`
- Modify: `src/app/paneladmin/(protected)/vivir-en-fuengirola/page.tsx`
- Modify: `src/app/paneladmin/(protected)/vivir-en-fuengirola/clientes/page.tsx`
- Modify: `src/app/paneladmin/(protected)/vivir-en-fuengirola/negocios/page.tsx`
- Modify: `src/app/paneladmin/(protected)/vivir-en-fuengirola/suscripciones/page.tsx`
- Modify: `src/app/paneladmin/(protected)/conoce-fuengirola/page.tsx`
- Modify: `src/app/paneladmin/(protected)/conoce-fuengirola/clientes/page.tsx`
- Modify: `src/app/paneladmin/(protected)/conoce-fuengirola/suscripciones/page.tsx`

**Interfaces:**
- Consumes: consultas y acciones de Task 3.
- Produces: `PlatformSectionNav({ section, currentPath, counts })` y `PlatformRequestInbox({ scope, data })`; URLs canónicas del spec y detalle mediante `?request=<uuid>`.

- [ ] **Step 1: Escribir pruebas de render que exijan navegación constante, contador pendiente, pestañas `Clientes/Negocios` en Vivir, filtros canónicos y aislamiento de datos.**

- [ ] **Step 2: Añadir pruebas para lista con búsqueda/estado/tipo/fecha, detalle que sustituye la tabla, volver atrás, render seguro de `profile_data`, aprobar/rechazar y enlace final `/paneladmin/clientes/{id}`.**

- [ ] **Step 3: Añadir prueba de regresión que mantenga visibles las tarjetas antiguas `clients.status='pending'` en Clientes y Negocios.**

- [ ] **Step 4: Ejecutar `node --test tests/platform-request-inbox-ui.test.mjs` y verificar que falla por componentes/rutas ausentes.**

- [ ] **Step 5: Implementar navegación e inbox reutilizables con enlaces del servidor y formularios de acciones; no duplicar la lógica de autorización ni consultar Supabase desde componentes cliente.**

- [ ] **Step 6: Implementar ambas páginas: Vivir traduce `scope=clients|businesses` a un único proyecto permitido; Conoce fuerza siempre `conoce-fuengirola`.**

- [ ] **Step 7: Sustituir los enlaces locales duplicados de las siete páginas existentes por `PlatformSectionNav`, conservando sus contenidos actuales.**

- [ ] **Step 8: Ejecutar la prueba dirigida y verificar `PASS`.**

- [ ] **Step 9: Commit.**

```bash
git add src/components/admin/platform-section-nav.tsx src/components/admin/platform-request-inbox.tsx 'src/app/paneladmin/(protected)/vivir-en-fuengirola' 'src/app/paneladmin/(protected)/conoce-fuengirola' tests/platform-request-inbox-ui.test.mjs
git commit -m "feat: add platform request inboxes"
```

### Task 5: Avisos en Inicio y contrato de integración para Claude

**Files:**
- Modify: `src/app/paneladmin/(protected)/inicio/page.tsx`
- Create: `docs/integrations/platform-requests-api.md`
- Create: `tests/platform-request-notifications.test.mjs`

**Interfaces:**
- Consumes: `getPendingPlatformRequestCounts()` de Task 3 y contrato de Task 2.
- Produces: avisos compactos por ámbito en Inicio y documentación autocontenida para los formularios públicos.

- [ ] **Step 1: Escribir prueba de Inicio: sin pendientes no aparece aviso; con pendientes aparecen tres contadores independientes y enlaces exactos a sus bandejas.**

- [ ] **Step 2: Escribir prueba documental que exija endpoint, orígenes, plataformas, payload, respuestas, Turnstile y ejemplos `curl` sin claves privadas.**

- [ ] **Step 3: Ejecutar `node --test tests/platform-request-notifications.test.mjs` y verificar el fallo inicial.**

- [ ] **Step 4: Implementar los avisos sin convertir Inicio en otra bandeja ni mezclar las tres listas.**

- [ ] **Step 5: Escribir el contrato para Claude e indicar expresamente que el despliegue de WF Panel precede al de los formularios.**

- [ ] **Step 6: Ejecutar la prueba dirigida y verificar `PASS`.**

- [ ] **Step 7: Commit.**

```bash
git add 'src/app/paneladmin/(protected)/inicio/page.tsx' docs/integrations/platform-requests-api.md tests/platform-request-notifications.test.mjs
git commit -m "feat: surface platform request notifications"
```

### Task 6: Verificación integral y preparación de entrega

**Files:**
- Modify only if verification reveals defects in files owned by Tasks 1–5.

**Interfaces:**
- Consumes: todos los entregables anteriores.
- Produces: rama verificable y contrato listo para coordinar con Claude; no despliega ni aplica la migración remota todavía.

- [ ] **Step 1: Ejecutar las pruebas dirigidas juntas: `node --test tests/platform-requests-migration.test.mjs tests/platform-requests-api.test.mjs tests/platform-requests-admin.test.mjs tests/platform-request-inbox-ui.test.mjs tests/platform-request-notifications.test.mjs`. Esperar 0 fallos.**

- [ ] **Step 2: Ejecutar `npm test`. Esperar toda la suite en verde, manteniendo únicamente los skips ya documentados del repositorio.**

- [ ] **Step 3: Ejecutar `npm run typecheck`, `npm run lint` y `npm run build`. Esperar código 0 en los tres.**

- [ ] **Step 4: Arrancar localmente y verificar con navegador: cada bandeja, búsqueda, detalle, contador, rechazo y aprobación contra una base de prueba; confirmar que aprobar no crea Auth ni pack.**

- [ ] **Step 5: Revisar `git diff`, confirmar que no se tocaron formularios de Claude ni secretos, y ejecutar `git diff --check`.**

- [ ] **Step 6: Usar `superpowers:requesting-code-review` para una revisión completa de la rama y corregir únicamente hallazgos verificados.**

- [ ] **Step 7: Crear el commit final solo si hubo correcciones de verificación.**

```bash
git add <archivos-corregidos>
git commit -m "fix: harden platform request workflow"
```
