# Seguridad de datos locales de WF Panel

## Intención

Hacer que el CRM y Bill-in sean fiables para el trabajo diario en este ordenador antes de conectar una base en la nube. El historial debe poder inspeccionarse, copiarse y recuperarse sin depender de la memoria del operador ni confundir datos reales con registros creados durante las pruebas.

## Objetivos

- Mostrar un diagnóstico reproducible del Supabase al que apunta el panel y negarse a operar si no es local.
- Crear copias fechadas del historial local con permisos privados, suma de comprobación y un manifiesto legible.
- Cubrir todas las tablas de negocio de `public` y solo `auth.users`/`auth.identities` de Auth, suficientes para conservar usuarios e inicios de sesión sin copiar sesiones, refresh tokens, MFA ni auditoría interna de GoTrue.
- Verificar una copia sin modificar la base activa.
- Preparar una restauración local protegida por confirmación explícita y documentar su ensayo sobre una base local desechable.
- Detectar por separado candidatos de demostración mediante reglas conservadoras y pedir confirmación antes de anular o eliminar nada.
- Mantener las copias fuera de Git y dejar el camino preparado para una futura migración a Supabase Cloud.

## No objetivos

- No conectar todavía un proyecto Supabase Cloud.
- No copiar datos a terceros ni subir copias automáticamente.
- No borrar datos legacy ni datos reales.
- No eliminar automáticamente los registros locales de validación existentes.
- No prometer que una contraseña puede recuperarse en texto claro; solo se conserva el estado interno de Auth cuando el volcado local lo permita.

## Restricciones y seguridad

- Los comandos de copia, diagnóstico y auditoría deben comprobar que la URL de Supabase es loopback y que el proyecto local está levantado.
- Los ficheros generados vivirán en `storage/local-backups/`, ignorados por Git, con modo `0600`.
- Ninguna salida mostrará `SUPABASE_SECRET_KEY`, tokens, hashes de contraseña ni contenido completo de mensajes o facturas.
- La restauración será destructiva por naturaleza: necesitará un indicador explícito, una copia válida y una segunda comprobación de destino local. El trabajo de implementación puede construirla y probar sus validaciones, pero no ejecutará una restauración destructiva sobre la base activa sin autorización en ese momento.
- La auditoría de demostración será solo lectura. Una limpieza futura trabajará sobre identificadores exactos revisados por el usuario, no sobre un borrado amplio por patrón.

## Enfoques considerados

### 1. Volcado nativo de PostgreSQL/Supabase más manifiesto — elegido

Crear un volcado local consistente de los esquemas necesarios y envolverlo con un manifiesto JSON que contenga versión, fecha, proyecto, tablas y recuentos no sensibles, tamaño y SHA-256. Es el camino con mayor fidelidad para relaciones, auditoría de facturas e identidades Auth, y permite validar la copia sin inventar un formato de datos propio.

Coste: el archivo contiene datos personales y estado de autenticación, por lo que debe permanecer privado y local. La restauración exige un PostgreSQL/Supabase compatible.

### 2. Exportación JSON por tabla

Es fácil de inspeccionar y migrar parcialmente, pero obliga a mantener orden de claves foráneas, tipos PostgreSQL, secuencias, auditorías e identidades Auth. Sería más frágil como copia de recuperación completa.

### 3. Sin copia local y conexión inmediata a Cloud

Reduce trabajo local, pero mezcla dos cambios de riesgo: migración de datos y cambio del backend activo. También requiere credenciales externas que no están disponibles. Se descarta hasta que la copia local esté verificada.

## Diseño funcional

### Diagnóstico

`npm run data:status`:

- carga `.env.local` sin imprimir secretos;
- confirma URL loopback y disponibilidad de Supabase;
- informa de la versión de migración y recuentos de clientes, dominios, servicios, facturas, propuestas, gastos y mensajes;
- informa de candidatos de demostración solo mediante identificadores, tipo y motivo, sin mostrar cuerpos de mensajes ni datos financieros completos;
- termina con error si el destino no es inequívocamente local.

### Copia y verificación

`npm run data:backup`:

- ejecuta un volcado consistente de todas las tablas de `public` y de `auth.users`/`auth.identities`; excluye de forma explícita sesiones, tokens, MFA y tablas internas volátiles;
- escribe el volcado y su manifiesto en una carpeta fechada;
- calcula SHA-256 y recuentos antes/después;
- aplica permisos privados;
- no sobrescribe una copia existente.

`npm run data:verify -- <manifest.json>`:

- valida formato, versión, rutas confinadas al directorio de copias, tamaño y SHA-256;
- comprueba que el volcado es legible con herramientas PostgreSQL sin restaurarlo;
- muestra un resumen no sensible y devuelve código distinto de cero si existe cualquier discrepancia.

### Restauración protegida

`npm run data:restore -- <manifest.json> --confirm-local-restore`:

- rechaza destinos no locales y copias no verificadas;
- exige que el operador escriba el indicador exacto;
- exige un stack local distinto, vacío y desechable; nunca resetea ni restaura sobre la instancia de trabajo activa;
- comprueba igualdad exacta del historial de migraciones antes de modificar datos; las migraciones posteriores se aplican únicamente después de una recuperación correcta;
- se niega a continuar si encuentra datos de negocio o identidades Auth en el destino;
- ejecuta después los recuentos del manifiesto y las invariantes de facturación;
- nunca se invoca automáticamente desde `setup:local`.

El primer ensayo real forma parte de esta entrega y se ejecuta sobre una segunda instancia local desechable con project ID y puertos aislados. La prueba levanta el destino, desactiva las protecciones de auditoría únicamente dentro de la transacción que vacía ese stack recién creado, restaura con el rol administrador local de Supabase, compara recuentos e invariantes y lo retira sin tocar la instancia de trabajo.

### Datos de demostración

`data:status` clasificará como candidatos, no como datos eliminables, únicamente las huellas exactas creadas durante la validación: cliente `cliente.demo@local.test`, propuesta externa `prueba@local.test` y gasto con proveedor `Prueba local WF-Panel`/concepto de prueba local. No usará un patrón amplio sobre `.local` o `.test`.

El administrador `admin@wf-panel.local` y los destinatarios placeholder `facturacion-no-disponible+wf001..003@wf-panel.local` de las tres facturas históricas quedan expresamente excluidos de candidatos demo. El diagnóstico guardará los UUID exactos y el motivo. La eliminación o anulación será una tarea posterior con confirmación específica; las facturas/propuestas conservarán su trazabilidad contable y se anularán en vez de borrarse cuando corresponda.

## Contrato de integridad

El manifiesto incluirá una entrada por cada tabla de usuario de `public`, no solo por las entidades visibles, incluyendo auditorías, secuencias, enlaces de pago, pendientes, notificaciones y asignaciones. También incluirá los recuentos de `auth.users` y `auth.identities`. La verificación compara el conjunto de tablas además de sus recuentos, de modo que una tabla nueva obliga a regenerar el contrato en vez de quedar silenciosamente fuera.

## Estructura propuesta

- `scripts/local-data-safety.mjs`: lógica pura de validación, manifiesto, rutas y clasificación.
- `scripts/local-data-db.mjs`: inventario reproducible de migraciones, tablas y recuentos.
- `scripts/local-data-backup.mjs`: creación y verificación offline del volcado.
- `scripts/local-data-restore.mjs`: barreras y comprobaciones de recuperación.
- `scripts/local-data-cli.mjs`: comandos y ejecución de Supabase/PostgreSQL.
- `scripts/test-local-data-recovery.mjs`: ensayo completo sobre un stack poseído y desechable.
- `tests/local-data-*.test.mjs`: pruebas de destino local, rutas, manifiestos, checksum, permisos, restauración y clasificación conservadora.
- `storage/local-backups/`: salida privada ignorada por Git.
- `README.md`: uso, límites y futura transición a Cloud.

## Criterios de éxito

- Una prueba demuestra que los comandos rechazan URLs cloud o ambiguas antes de ejecutar procesos.
- Una copia local se genera con permisos `0600`, manifiesto y checksum verificables.
- Alterar un byte hace fallar la verificación.
- El diagnóstico devuelve los recuentos de Bill-in y CRM sin filtrar secretos.
- Los candidatos demo se listan pero no se modifican.
- La restauración carece de camino accidental: sin indicador exacto no ejecuta ningún comando destructivo.
- Lint, TypeScript, suite completa y build permanecen verdes.

## Decisiones dejadas al constructor

- La forma exacta de invocar `pg_dump`/`pg_restore` o el wrapper equivalente de Supabase, siempre que conserve los esquemas requeridos y sea comprobable en macOS con el runtime local ya instalado.
- El formato interno de las funciones puras y los mensajes de consola, manteniendo los límites de seguridad anteriores.
