# Bandejas de solicitudes por plataforma

## Intención

WF Panel debe recibir las fichas que las webs públicas preparadas por Claude envíen y mostrarlas como trabajo pendiente dentro de su plataforma correspondiente. Una solicitud todavía no es un cliente, un negocio ni una cuenta de acceso: el administrador debe revisarla y aprobarla antes de incorporarla al CRM.

La primera versión tendrá tres ámbitos independientes, alineados con los espacios que ya existen en la base de datos:

- `vivir-fuengirola`: clientes de Vivir en Fuengirola.
- `vivir-fuengirola-negocios`: negocios de Vivir en Fuengirola.
- `conoce-fuengirola`: clientes o negocios de Conoce Fuengirola.

## Objetivos

- Añadir una bandeja `Solicitudes` dentro de cada ámbito, con su propio contador.
- Recibir de forma segura una ficha pública sin crear antes una identidad de Supabase Auth.
- Mostrar en WF Panel los datos recibidos, su procedencia, fecha y estado.
- Permitir aprobar o rechazar una solicitud con trazabilidad.
- Convertir una solicitud aprobada en el registro `clients` del ámbito exacto, sin duplicados.
- Mantener el alta manual que ya existe en Clientes y Negocios.
- Dar a Claude un contrato HTTP estable que pueda integrar sin editar la lógica interna del panel.
- Mostrar una notificación dentro del panel cuando existan solicitudes nuevas.

## No objetivos de esta fase

- No enviar correos ni notificaciones push al administrador.
- No crear automáticamente una contraseña ni una cuenta Auth al aprobar.
- No crear automáticamente una suscripción, factura o cobro.
- No mezclar las solicitudes públicas con los mensajes o pendientes de clientes existentes.
- No leer directamente bases de datos independientes de Vivir o Conoce.

## Enfoques considerados

### 1. Reutilizar `clients.status = 'pending'`

Es el cambio más pequeño y coincide con una implementación antigua que todavía aparece dentro de las páginas de clientes. Se descarta porque mezcla una solicitud no verificada con el CRM real, acopla el registro público con Auth y deja poco espacio para guardar una ficha variable o un historial de revisión.

### 2. Tabla central `platform_requests` con vistas filtradas — elegido

Una única tabla segura conserva el contrato, la auditoría y la deduplicación. Cada página consulta únicamente su ámbito y presenta una bandeja independiente. La aprobación convierte la solicitud a `clients` mediante una operación atómica. Es la opción más sencilla de mantener sin sacrificar separación visual ni seguridad.

### 3. Una base de datos por portal

Ofrece aislamiento físico, pero obliga a WF Panel a mantener varias credenciales, estados de error y conversiones remotas. Se descarta en esta fase porque las solicitudes deben convertirse en registros del CRM central.

## Modelo de datos

La migración crea `public.platform_requests`:

- `id uuid primary key`.
- `platform text` limitado a los tres ámbitos aprobados.
- `request_type text` limitado inicialmente a `client`, `business` y `subscription_interest`.
- `name`, `email`, `phone`, `company` como datos comunes normalizados.
- `profile_data jsonb` para la ficha ampliable de cada web; solo admite un objeto JSON y queda limitada en tamaño en la API.
- `message text` y `source_url text` opcionales.
- `status text`: `pending`, `approved` o `rejected`.
- `fingerprint text` para deduplicación idempotente, calculado en el servidor y no aceptado del navegador.
- `converted_client_id uuid` opcional hacia `clients`.
- `reviewed_by uuid`, `reviewed_at timestamptz` y `rejection_reason text` opcionales.
- `created_at` y `updated_at`.

Un índice único parcial impide dos solicitudes `pending` con la misma huella. La huella incluye plataforma, tipo y email normalizado; los reintentos del formulario devuelven la solicitud pendiente existente en lugar de duplicarla.

`name` y `email` son obligatorios para los tres tipos y las tres plataformas. El correo se normaliza a minúsculas antes de calcular la huella, buscar un cliente o persistir la solicitud. Esta primera versión no admite solicitudes anónimas ni fichas sin una identidad de contacto estable.

RLS queda activado. Los usuarios `anon` y `authenticated` no reciben permisos directos de escritura. Los administradores autenticados pueden leer mediante la política existente `private.is_admin()`. Las mutaciones administrativas se realizan en acciones de servidor. La entrada pública solo pasa por la API validada.

## Contrato público para Claude

WF Panel expone:

- `GET /api/platform-requests/config` para indicar si Turnstile está disponible y entregar únicamente su site key pública.
- `OPTIONS /api/platform-requests` para CORS.
- `POST /api/platform-requests` para registrar una solicitud.

El cuerpo de `POST` será:

```json
{
  "platform": "vivir-fuengirola",
  "requestType": "client",
  "name": "Nombre",
  "email": "persona@example.com",
  "phone": "+34 ...",
  "company": "Empresa opcional",
  "message": "Nota opcional",
  "profile": {},
  "sourceUrl": "https://vivirenfuengirola.com/...",
  "website": "",
  "token": "turnstile-token"
}
```

El servidor no confía en `platform`: cada origen CORS permitido está vinculado a uno o varios ámbitos concretos. Un origen de Conoce no puede registrar una solicitud de Vivir. La API mantiene una lista explícita de dominios HTTPS canónicos y `www`, valida que `sourceUrl` pertenezca al mismo origen, limita longitudes y profundidad de `profile`, usa el campo señuelo `website`, verifica Turnstile y devuelve respuestas sin datos privados:

- `https://vivirenfuengirola.com` y `https://www.vivirenfuengirola.com` pueden enviar `vivir-fuengirola` y `vivir-fuengirola-negocios`.
- `https://conocefuengirola.com` y `https://www.conocefuengirola.com` solo pueden enviar `conoce-fuengirola`.
- En desarrollo se admite exclusivamente el origen local configurado mediante `PLATFORM_REQUEST_DEV_ORIGIN` cuando `NODE_ENV !== 'production'`; nunca se amplía la lista de producción con comodines.

La comprobación de Turnstile exige además que el hostname verificado corresponda al origen permitido. La API no refleja un origen desconocido en las cabeceras CORS.

El cuerpo HTTP completo queda limitado a 32 KiB. `profile` admite como máximo 24 KiB serializados, cinco niveles y cien claves totales. Los límites de los campos comunes son: nombre 120, email 160, teléfono 80, empresa 160, mensaje 5.000 y URL de origen 500 caracteres.

- `201 { success: true, outcome: "created" }`.
- `200 { success: true, outcome: "existing" }` para un reintento idempotente.
- `400 invalid_payload` o `turnstile_failed`.
- `403 forbidden_origin` o `platform_not_allowed`.
- `503 requests_not_configured` si la protección pública obligatoria no está configurada en producción.

El contrato se documentará también en un archivo breve para que Claude pueda consumirlo sin inspeccionar la implementación.

## Navegación e interfaz

Cada ámbito incorpora una navegación contextual constante:

- Vivir: `Resumen`, `Clientes`, `Suscripciones`, `Negocios`, `Solicitudes`.
- Vivir Negocios: la misma entrada `Solicitudes` puede abrir la bandeja filtrada a `vivir-fuengirola-negocios` mediante una pestaña visible dentro de la pantalla de solicitudes.
- Conoce: `Resumen`, `Clientes`, `Suscripciones`, `Solicitudes`.

Las URLs canónicas serán:

- `/paneladmin/vivir-en-fuengirola/solicitudes?scope=clients`.
- `/paneladmin/vivir-en-fuengirola/solicitudes?scope=businesses`.
- `/paneladmin/conoce-fuengirola/solicitudes`.

La bandeja muestra nuevas primero, búsqueda, tipo, fecha, estado y origen. Al abrir una solicitud desaparece la tabla y aparece una ficha completa con volver atrás, datos recibidos y acciones `Aprobar` y `Rechazar`.

El contador de pendientes aparece en la entrada `Solicitudes`. `/paneladmin/inicio` muestra además una notificación compacta por plataforma cuando el contador sea mayor que cero; cada aviso enlaza a su bandeja, sin fusionar las listas.

## Aprobación y rechazo

La aprobación se ejecuta en una función transaccional de base de datos:

1. Exige administrador y bloquea la solicitud pendiente.
2. Valida que el ámbito siga permitido.
3. Busca un cliente por `project + lower(email)`.
4. Si existe, enlaza la solicitud sin sobrescribir silenciosamente su ficha y devuelve `existing_client`.
5. Si no existe, intenta crear `clients` con `status = 'active'`, el `project` exacto y los campos comunes normalizados usando la restricción única existente `clients_project_email_lower_unique_idx`.
6. Marca la solicitud como aprobada, almacena administrador, fecha y `converted_client_id`.

La operación no confía únicamente en el bloqueo de la solicitud: la restricción única sobre `clients(project, lower(email))` arbitra también aprobaciones concurrentes de solicitudes distintas para la misma persona. Si la inserción pierde la carrera, la función vuelve a consultar y enlaza el cliente que ganó. La migración previa que creó ese índice ya habría fallado ante duplicados históricos, por lo que la nueva migración verifica su existencia y se detiene con un error explícito si la garantía no está disponible; no decide ni elimina duplicados automáticamente.

La correspondencia de plataforma, proyecto y destino es fija:

- `vivir-fuengirola` → `clients.project = 'vivir-fuengirola'` → `/paneladmin/clientes/{id}`.
- `vivir-fuengirola-negocios` → `clients.project = 'vivir-fuengirola-negocios'` → `/paneladmin/clientes/{id}`.
- `conoce-fuengirola` → `clients.project = 'conoce-fuengirola'` → `/paneladmin/clientes/{id}`.

La ficha completa común es el destino después de aprobar; las rutas contextuales de Clientes o Negocios siguen siendo las bandejas/listas desde las que se llega a ella.

`subscription_interest` sigue el mismo paso de creación o enlace del cliente activo, pero termina mostrando una acción administrativa para preparar su suscripción. No crea un pack, una factura, un cobro ni una suscripción activa automáticamente.

La acción devuelve un enlace a la ficha resultante. Desde su sección `Acceso`, el administrador podrá usar la función ya existente para crear una contraseña temporal; la aprobación no crea credenciales por sorpresa.

El rechazo exige una solicitud pendiente, admite un motivo breve opcional y registra quién y cuándo la rechazó. No elimina datos ni identidades.

## Datos existentes

Los clientes actuales permanecen sin cambios. Las tarjetas embebidas de `pendingClients` se conservarán durante la transición para no ocultar registros históricos `clients.status = 'pending'`, pero las nuevas altas públicas entrarán exclusivamente en `platform_requests`. Una migración posterior podrá convertir pendientes antiguos cuando se confirme su procedencia.

Los negocios que el usuario espera ver no se inventarán ni se reclasificarán automáticamente: primero se identificará su fuente actual y se importarán con un proceso explícito y verificable.

## Coordinación con Claude

WF Panel es propietario del esquema, la API, las bandejas y la conversión al CRM. Claude solo necesita integrar el formulario público contra el contrato documentado. La integración se hará contra una revisión publicada de la API; no se compartirán claves de servicio ni acceso directo a las tablas.

Antes de mezclar cambios se comprobarán ambos repositorios y se evitará editar los archivos del formulario público que Claude tenga sin confirmar. Las pruebas de contrato de WF Panel usarán los mismos cuerpos y respuestas que se entreguen a Claude.

## Verificación

- Pruebas de migración: restricciones, RLS, permisos, deduplicación y operación atómica.
- Pruebas de API: CORS exacto, mapeo origen-ámbito, Turnstile, señuelo, límites, idempotencia y errores seguros.
- Pruebas administrativas: aislamiento por ámbito, contadores, búsqueda, detalle, aprobación, rechazo y enlaces.
- Prueba de regresión: la creación manual de clientes y negocios continúa funcionando.
- Prueba de integración: un envío de cada origen permitido aparece únicamente en su bandeja y su aprobación crea o enlaza el cliente correcto.
- `npm test`, `npm run typecheck`, `npm run lint` y `npm run build`.

## Despliegue

1. Aplicar la migración de `platform_requests` en Studio Panel.
2. Desplegar WF Panel con Turnstile configurado y verificar la API desde los orígenes permitidos.
3. Entregar a Claude el contrato y conectar primero una plataforma.
4. Probar envío, duplicado, aparición en bandeja, aprobación y acceso al cliente.
5. Conectar las plataformas restantes sin cambiar el contrato.

El despliegue de la API debe completarse antes de publicar el formulario de Claude; así nunca habrá solicitudes que el panel no pueda conservar.
