# Panel WF Studio - Operaciones pendientes fuera de este repo

## P0 cron de pendientes

El endpoint `/api/pending-reminders` exige `PENDING_REMINDERS_CRON_SECRET` o `CRON_SECRET`; sin secreto responde `503 cron_not_configured`.

- En Coolify, crear una tarea programada diaria a las `08:00` que invoque `/api/pending-reminders` con `Authorization: Bearer <secret>`.
- Usar `CRON_SECRET` como secreto compartido o `PENDING_REMINDERS_CRON_SECRET` como secreto específico del endpoint.
- No incluir `?secret=`: el endpoint no lo acepta y las URLs suelen quedar en logs.
- Alertar cuando `ok` sea `false` o `failed` no este vacio. Cada fallo indica `id`, fase `claim|send|persist|release` y mensaje.
- Mantener Resend como proveedor del cron o conservar una clave de idempotencia equivalente si se cambia de proveedor.

## Informes estadísticos mensuales

El endpoint `/api/monthly-stat-reports` exige `MONTHLY_STAT_REPORTS_CRON_SECRET` o `CRON_SECRET`; sin secreto responde `503 cron_not_configured`.

- En Coolify, programar la tarea cada 30 minutos durante los primeros siete días de cada mes. Las repeticiones reintentan configuraciones incompletas y mantienen cualquier recuperación de un envío ambiguo dentro de la ventana de idempotencia del proveedor.
- Invocar `/api/monthly-stat-reports` con `curl --fail-with-body` y `Authorization: Bearer <secret>` o `x-cron-secret`; un informe incompleto responde `503` para que Coolify marque el intento como fallido.
- Variables mínimas: `UMAMI_PERSONAL_URL`, `UMAMI_PERSONAL_PASSWORD`, `UMAMI_AGAMA_URL`, `UMAMI_AGAMA_PASSWORD`, `STAT_REPORT_EMAIL_TO` o `RESEND_TO_EMAIL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` y `SUPABASE_SECRET_KEY`.
- `MONTHLY_STAT_REPORTS_CRON_SECRET` es opcional; el endpoint acepta tanto este secreto como `CRON_SECRET`.
- Variables recomendadas: los catorce `UMAMI_WEBSITE_ID_*` para evitar depender del listado global de cada Umami.
- TodoPlástico debe usar exclusivamente la instancia Agama `https://analytics.2.24.10.239.sslip.io`; los otros trece sitios usan la instancia personal `https://analytics.187.124.55.36.sslip.io`.
- El panel reutiliza el mismo núcleo dual y cachea las lecturas durante 300 segundos. Un fallo de una instancia queda reflejado por sitio sin cancelar el informe de la otra.
- Los antiguos `STAT_REPORT_UMAMI_*` siguen funcionando como fallback de la instancia personal, pero no sustituyen ninguna variable de Agama.
- Aplicar las migraciones `202608260001_monthly_stat_reports.sql` y `202608300001_monthly_stat_report_snapshot_integrity.sql` antes de activar el cron. Cada mes se guarda atómicamente en `monthly_stat_reports`, usando `SUPABASE_SECRET_KEY`; el panel autenticado conserva acceso de solo lectura mediante RLS.
- El envío adquiere primero un claim recuperable en Supabase, persiste fecha e ID de Resend y conserva además la clave de idempotencia `monthly-stat-report-YYYY-MM`.
- Un informe incompleto se persiste para diagnóstico pero no se envía. El cron debe reintentarse después de corregir los sitios hasta obtener los catorce estados `ok`.
- Después de confirmar un envío, las reejecuciones conservan el Markdown y los datos exactos asociados al `email_message_id`; no sobrescriben el snapshot enviado.
- El claim funciona como un lease de 15 minutos. Si el proceso cae antes de terminar, la siguiente ejecución lo recupera y reutiliza la misma clave de idempotencia mensual; no espaciar los reintentos más de 30 minutos.
- Alertar cualquier respuesta no satisfactoria. Si al terminar el día 7 queda un envío ambiguo sin confirmar, revisar el correo en Resend y reconciliar `email_sent_at`/`email_message_id` antes de ejecutar manualmente fuera de la ventana automática.

## Superentrenador - Umami

Ejecutar en el repo de Superentrenador, no en WF Studio:

- Crear un website en Umami y guardar su id en `NEXT_PUBLIC_UMAMI_WEBSITE_ID`.
- Guardar el script en `NEXT_PUBLIC_UMAMI_SCRIPT_URL`, por ejemplo `https://analytics.example.com/script.js`.
- Insertar en el layout raiz un script `defer` con esa URL y `data-website-id`. Repetirlo en marketplace, panel entrenador o panel alumno si no heredan ese layout.
- Autorizar el host de Umami en `script-src` y `connect-src` si existe CSP.
- Verificar que el script carga con 200 y envia eventos sin emails, nombres ni datos personales.
- Medir rutas y eventos `trainer_search`, `trainer_profile_view`, `signup_started`, `signup_completed`, `trainer_contact_started` y `subscription_started`.
- Exponer a WF Studio solo metricas agregadas mediante API segura o vista con service key.

## Apps educativas

- Registrar cada app en `app_memberships.app`.
- Mantener `list_premium_codes`, `generate_premium_code` y `cancel_premium_code`.
- Añadir un campo/parametro `app` a esas RPC antes de presentar los codigos como exclusivos de Samuel Coach; mientras no exista, WF los rotula como premium educativo compartido.
- Confirmar acceso service role a perfiles, membresias, progreso e intentos.

## TodoPlastico

- Definir `TODO_PLASTICO_URL`, `TODO_PLASTICO_SERVICE_KEY` y `TODO_PLASTICO_ADMIN_URL`.
- Usar `https://todo-plastico.com/ingresar?next=/admin` para administración y `https://todo-plastico.com/panel` para clientes; no derivar rutas desde `agama.eco` ni `agamaeu.com`.
- Mantener accesibles `mkt_companies`, `mkt_listings` y Auth Admin para service role.
- Confirmar empresas `active|blocked` y anuncios `pending_review|published|rejected`.
- No exponer la service key al navegador.

## Checklist

- Aplicar las migraciones `202608190001_client_auth_identity.sql`, `202608230001_client_summary_active_packs.sql` y `202608230002_pending_reminder_claims.sql`.
- Ejecutar `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`.
- Confirmar que `Proyectos` sigue sin cambios funcionales.
