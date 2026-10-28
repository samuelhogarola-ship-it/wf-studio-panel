# Local Data Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir diagnóstico, copia verificable y recuperación aislada de los datos locales de CRM y Bill-in sin permitir operaciones accidentales sobre una base remota o la instancia de trabajo.

**Architecture:** Separar funciones puras de seguridad/manifiesto, acceso PostgreSQL local y orquestación CLI. El volcado será un archivo custom de PostgreSQL con todas las tablas `public` y solo `auth.users`/`auth.identities`; la recuperación exigirá un segundo Supabase local vacío con el mismo historial de migraciones y se ensayará end-to-end en un stack temporal.

**Tech Stack:** Node.js ESM, Node test runner, `pg`, Supabase CLI, PostgreSQL 17, Docker/Colima.

**Spec:** `docs/superpowers/specs/2026-10-28-local-data-safety-design.md`

## Global Constraints

- Ningún comando de datos puede operar si API URL y DB URL no son loopback.
- Las copias viven en `storage/local-backups/`, fuera de Git, con directorio `0700` y archivos `0600`.
- No se imprimen claves, URLs con contraseña, hashes Auth ni contenidos completos de documentos o mensajes.
- La copia incluye todas las tablas de usuario de `public` y únicamente `auth.users`/`auth.identities` de Auth.
- La restauración nunca resetea ni modifica la instancia de trabajo; exige otro destino local vacío y `--confirm-local-restore`.
- La compatibilidad requiere igualdad exacta de versiones en `supabase_migrations.schema_migrations`.
- Los candidatos demo se detectan por huellas exactas y nunca se modifican en esta entrega.

## Review Focus

- Una URL como `http://127.0.0.1.evil.example` o una DB URL con host remoto debe rechazarse, no aceptarse por prefijo.
- Rutas con `..`, enlaces simbólicos o manifiestos que apunten fuera de `storage/local-backups` deben rechazarse antes de leer el volcado.
- Un volcado truncado o cambiado después de crear el manifiesto debe fallar por tamaño/checksum antes de invocar restauración.
- Un destino local no vacío o igual a la fuente debe rechazarse incluso con el indicador de confirmación.
- El administrador local y las tres facturas históricas placeholder no deben aparecer como candidatos demo.

---

### Task 1: Primitivas de seguridad y manifiesto

**Files:**
- Create: `scripts/local-data-safety.mjs`
- Test: `tests/local-data-safety.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `assertLoopbackHttpUrl(value) -> URL`, `assertLoopbackDatabaseUrl(value) -> URL`, `resolveConfinedBackupPath(root, candidate) -> string`, `sha256File(path) -> Promise<string>`, `createBackupManifest(input) -> object`, `verifyBackupManifest({ root, manifestPath }) -> Promise<object>`, `classifyKnownDemoRecords(snapshot) -> DemoCandidate[]`.
- `DemoCandidate` contiene solo `{ entity, id, reason }`.

- [ ] **Step 1: Escribir pruebas rojas de hosts, rutas y candidatos demo**

Añadir casos que acepten `localhost`, `127.0.0.1`, `::1`; rechacen hosts parecidos/remotos; rechacen traversal; incluyan las tres huellas demo exactas; y excluyan `admin@wf-panel.local` y `facturacion-no-disponible+wf001..003@wf-panel.local`.

- [ ] **Step 2: Ejecutar la prueba y observar el fallo por módulo ausente**

Run: `node --test tests/local-data-safety.test.mjs`
Expected: FAIL porque `scripts/local-data-safety.mjs` no existe.

- [ ] **Step 3: Implementar validación local, confinamiento y clasificación mínima**

Usar `URL.hostname` y el conjunto exacto `localhost`, `127.0.0.1`, `::1`; resolver rutas mediante `realpath` del padre existente y negar cualquier salida del root. No usar coincidencias amplias `.local`/`.test` para candidatos demo.

- [ ] **Step 4: Añadir prueba roja de manifiesto/checksum y permisos**

Crear un volcado temporal, generar manifiesto, verificarlo, modificar un byte y exigir error. Comprobar que el manifiesto no serializa URLs, claves ni contenidos.

- [ ] **Step 5: Implementar manifiesto versión 1 y verificación**

`createBackupManifest` fija `format: 'wf-panel-local-backup'`, `version: 1`, fecha ISO, project ID, versiones de migración, conjunto/recuentos de tablas, nombre relativo del dump, tamaño y SHA-256. `verifyBackupManifest` valida esquema, ruta confinada, tamaño y hash.

- [ ] **Step 6: Ignorar copias locales y ejecutar pruebas**

Añadir `storage/local-backups/` a `.gitignore`.

Run: `node --test tests/local-data-safety.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add .gitignore scripts/local-data-safety.mjs tests/local-data-safety.test.mjs
git commit -m "feat: add local data safety primitives"
```

### Task 2: Diagnóstico local de CRM y Bill-in

**Files:**
- Create: `scripts/local-data-db.mjs`
- Create: `scripts/local-data-cli.mjs`
- Test: `tests/local-data-status.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: validadores y `classifyKnownDemoRecords` de Task 1.
- Produces: `readSupabaseLocalContext({ run, root }) -> { projectId, apiUrl, dbUrl, containerId }`, `collectLocalDataStatus({ db }) -> { migrations, tables, demoSnapshot }`, subcomando `status`.
- `tables` contiene todas las tablas base de `public` más `auth.users` y `auth.identities`, ordenadas y con recuento.

- [ ] **Step 1: Escribir pruebas rojas del contexto local y redacción de errores**

Inyectar un `run` falso con salida de `supabase status`/`docker ps`; exigir rechazo previo para URL remota, selección por label del contenedor DB y errores sin DB URL ni service key.

- [ ] **Step 2: Ejecutar la prueba y observar el fallo**

Run: `node --test tests/local-data-status.test.mjs`
Expected: FAIL por exports ausentes.

- [ ] **Step 3: Implementar resolución del contexto local**

Reutilizar `parseSupabaseEnv` de `scripts/setup-local.mjs`; ejecutar con telemetría desactivada; resolver el contenedor por `com.supabase.cli.project=<projectId>` y ancestor `supabase/postgres`; devolver errores sanitizados.

- [ ] **Step 4: Escribir prueba roja del estado y el resumen seguro**

Usar un adaptador DB falso para exigir consulta de tablas, versiones de migración y huellas demo; verificar que la salida formateada contiene recuentos/UUID pero no claves, URL DB, importes, cuerpos ni emails históricos completos.

- [ ] **Step 5: Implementar acceso `pg` y subcomando `status`**

El adaptador real abre una conexión breve a `dbUrl`, enumera `pg_catalog`, cuenta tablas, obtiene versiones de migración y consulta únicamente columnas mínimas para las huellas demo. Cerrar siempre el cliente.

- [ ] **Step 6: Añadir script y verificar**

Añadir `"data:status": "node scripts/local-data-cli.mjs status"`.

Run: `node --test tests/local-data-status.test.mjs tests/local-data-safety.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/local-data-db.mjs scripts/local-data-cli.mjs tests/local-data-status.test.mjs
git commit -m "feat: add local data diagnostics"
```

### Task 3: Copia privada y verificación offline

**Files:**
- Modify: `scripts/local-data-cli.mjs`
- Create: `scripts/local-data-backup.mjs`
- Test: `tests/local-data-backup.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: contexto/estado de Task 2 y manifiesto de Task 1.
- Produces: `createLocalBackup({ context, status, backupRoot, run, now }) -> { manifestPath, dumpPath }`, `verifyLocalBackup({ manifestPath, backupRoot, run, context }) -> manifest`, subcomandos `backup` y `verify`.

- [ ] **Step 1: Escribir prueba roja del comando de volcado**

Con runner inyectado, exigir container ID exacto, formato custom, datos de todo `public`, tablas `auth.users`/`auth.identities`, exclusión de blobs/sesiones/tokens, rutas sin sobrescritura y ausencia de secretos en argumentos seguros/logs.

- [ ] **Step 2: Ejecutar la prueba y observar el fallo**

Run: `node --test tests/local-data-backup.test.mjs`
Expected: FAIL por módulo ausente.

- [ ] **Step 3: Implementar creación de copia**

Crear carpeta `YYYY-MM-DDTHH-mm-ss-sssZ` en modo `0700`; ejecutar `pg_dump` dentro del contenedor DB y copiar el archivo custom al host; fijar `0600`; recalcular estado, construir manifiesto y escribirlo atómicamente en `0600`.

- [ ] **Step 4: Escribir prueba roja de verificación PostgreSQL**

Exigir que checksum/tamaño se comprueben antes que `pg_restore --list`; un manifiesto alterado no debe llamar al runner; un archivo válido debe pasar una inspección de archive list.

- [ ] **Step 5: Implementar verificación**

Copiar temporalmente el dump al contenedor identificado y ejecutar `pg_restore --list` sin conectar a la base. Limpiar el temporal en `finally`.

- [ ] **Step 6: Añadir scripts y verificar**

Añadir `"data:backup": "node scripts/local-data-cli.mjs backup"` y `"data:verify": "node scripts/local-data-cli.mjs verify"`.

Run: `node --test tests/local-data-backup.test.mjs tests/local-data-status.test.mjs tests/local-data-safety.test.mjs`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/local-data-cli.mjs scripts/local-data-backup.mjs tests/local-data-backup.test.mjs
git commit -m "feat: add verified local backups"
```

### Task 4: Restauración protegida y ensayo aislado

**Files:**
- Create: `scripts/local-data-restore.mjs`
- Create: `scripts/test-local-data-recovery.mjs`
- Test: `tests/local-data-restore.test.mjs`
- Modify: `scripts/local-data-cli.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: backup verificado de Task 3 y consultas DB de Task 2.
- Produces: `validateRestoreRequest({ source, target, manifest, confirmation, targetStatus })`, `restoreLocalBackup({ manifestPath, targetContext, run })`, subcomando `restore`, y prueba end-to-end `npm run test:data-recovery`.
- El destino llega mediante `LOCAL_RESTORE_DATABASE_URL` y `LOCAL_RESTORE_PROJECT_ID`; nunca por un default implícito.

- [ ] **Step 1: Escribir pruebas rojas de todas las barreras destructivas**

Rechazar confirmación ausente/incorrecta, destino remoto, destino igual a fuente, migraciones distintas, cualquier tabla de negocio/identidad no vacía y dump no verificado. Afirmar que el runner no fue llamado en todos los rechazos.

- [ ] **Step 2: Ejecutar la prueba y observar el fallo**

Run: `node --test tests/local-data-restore.test.mjs`
Expected: FAIL por módulo ausente.

- [ ] **Step 3: Implementar validación y restauración mínima**

Solo después de todas las barreras, ejecutar `pg_restore --data-only --exit-on-error` contra el destino local. Comparar después conjunto/recuentos de tablas, versiones e invariantes: ninguna propuesta con payment link, tipos documentales inmutables instalados y secuencias de numeración presentes.

- [ ] **Step 4: Escribir prueba roja del runner desechable**

Probar generación de config con project ID único/puertos locales distintos, cleanup en `finally`, bloqueo de concurrencia y comandos seguros sin contraseñas en diagnósticos.

- [ ] **Step 5: Implementar el ensayo end-to-end**

Crear workspace temporal, copiar `supabase/config.toml` y migraciones, asignar puertos libres, arrancar segundo Supabase, crear una copia de la fuente, restaurarla en el destino, comparar estado y detener únicamente el stack poseído.

- [ ] **Step 6: Añadir scripts y ejecutar pruebas unitarias**

Añadir `"data:restore": "node scripts/local-data-cli.mjs restore"` y `"test:data-recovery": "node scripts/test-local-data-recovery.mjs"`.

Run: `node --test tests/local-data-restore.test.mjs tests/local-data-backup.test.mjs tests/local-data-status.test.mjs tests/local-data-safety.test.mjs`
Expected: PASS.

- [ ] **Step 7: Ejecutar ensayo real aislado**

Run: `npm run test:data-recovery`
Expected: crea un segundo stack, restaura, compara recuentos/invariantes y lo elimina; la fuente permanece sin cambios.

- [ ] **Step 8: Commit**

```bash
git add package.json scripts/local-data-cli.mjs scripts/local-data-restore.mjs scripts/test-local-data-recovery.mjs tests/local-data-restore.test.mjs
git commit -m "feat: add guarded local recovery drill"
```

### Task 5: Documentación y verificación completa

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-28-local-data-safety-design.md`
- Create: `docs/superpowers/plans/2026-10-28-local-data-safety.md`

**Interfaces:**
- Consumes: los cuatro comandos y el ensayo de Tasks 1–4.
- Produces: instrucciones de operación local y handoff claro hacia Supabase Cloud.

- [ ] **Step 1: Documentar diagnóstico, copia, verificación y recuperación**

Incluir comandos exactos, ubicación privada, datos incluidos/excluidos, advertencia de PII, requisito de destino desechable y explicación de candidatos demo. La transición Cloud queda como fase posterior que parte de una copia verificada.

- [ ] **Step 2: Ejecutar herramientas reales no destructivas**

Run: `npm run data:status`
Expected: recuentos y candidatos exactos sin secretos.

Run: `npm run data:backup`
Expected: manifiesto y dump privados bajo `storage/local-backups/`.

Run: `npm run data:verify -- <manifest-generado>`
Expected: verificación satisfactoria.

- [ ] **Step 3: Ejecutar verificación completa**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: todos los comandos finalizan con código 0; la suite solo conserva skips explícitos preexistentes.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-10-28-local-data-safety-design.md docs/superpowers/plans/2026-10-28-local-data-safety.md
git commit -m "docs: document local data recovery"
```
