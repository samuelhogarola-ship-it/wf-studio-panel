# Studio Panel

Subapp independiente para WF-Studio con:

- panel administrador protegido
- portal cliente por magic link
- gestión de clientes
- packs/bonos de horas
- actividades y consumo
- notificaciones email con Resend

## Stack

- Next.js 15
- App Router
- TypeScript
- Tailwind CSS
- Supabase SSR
- Supabase Auth + Database
- Resend

## Instalación

1. Clona el repo:

```bash
git clone https://github.com/samuelhogarola-ship-it/wf-studio-panel.git
```

2. Instala dependencias:

```bash
npm install
```

3. Crea `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
APP_URL=http://localhost:3000
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=
PENDING_REMINDERS_CRON_SECRET=
TODO_PLASTICO_URL=
TODO_PLASTICO_SERVICE_KEY=
TODO_PLASTICO_ADMIN_URL=
NEXT_PUBLIC_TODO_PLASTICO_PUBLIC_URL=
NEXT_PUBLIC_TODO_PLASTICO_ADMIN_URL=
SUPERENTRENADOR_URL=
SUPERENTRENADOR_SERVICE_KEY=
NEXT_PUBLIC_SUPERENTRENADOR_URL=
NEXT_PUBLIC_COACH_STUDIO_URL=
APPS_USERS_URL=
APPS_USERS_SERVICE_KEY=
IMKONTEXT_URL=
IMKONTEXT_SERVICE_KEY=
```

4. Aplica las migraciones SQL en tu proyecto Supabase:

- carpeta: [`supabase/migrations/`](supabase/migrations/)

5. Arranca en local:

```bash
npm run dev
```

## Rutas

- `/paneladmin`
- `/paneladmin/dashboard`
- `/paneladmin/clientes`
- `/paneladmin/bonos`
- `/paneladmin/actividades`
- `/cliente`
- `/cliente/dashboard`
- `/auth/callback`

## Primer administrador

1. Crea el usuario en Supabase Auth con email y contraseña.
2. Comprueba que el trigger ha creado su fila en `public.profiles`.
3. Promociónalo a admin:

```sql
update public.profiles
set role = 'admin'
where email = 'tu-admin@dominio.com';
```

## CI

El workflow `.github/workflows/ci.yml` se ejecuta automáticamente en push/PR a `main`.

Pasos: `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`.

El build funciona sin credenciales reales: las páginas dinámicas (las que usan cookies) no se pre-renderizan en build time, y el acceso a env vars está detrás de funciones lazy. No se necesita configurar secrets en GitHub para que el CI pase.

### Variables de entorno en producción (Coolify)

Configura estas variables en Coolify antes de hacer el primer deploy:

| Variable                               | Descripción                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto Supabase                                                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública (anon key)                                                           |
| `SUPABASE_SECRET_KEY`                  | Service role key; solo servidor, también persiste los informes mensuales           |
| `APP_URL`                              | URL canónica del panel para magic links, callbacks y metadatos                     |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`       | Site key pública de Cloudflare Turnstile para `/api/contact/config`                |
| `TURNSTILE_SECRET_KEY`                 | Secret key privada de Cloudflare Turnstile para validar el token en `/api/contact` |
| `RESEND_API_KEY`                       | API key de Resend para emails                                                      |
| `RESEND_FROM_EMAIL`                    | Email remitente verificado en Resend                                               |
| `NEXT_PUBLIC_APP_URL`                  | URL pública expuesta al cliente; mantenerla igual que `APP_URL`                    |
| `CRON_SECRET`                          | Secreto compartido para tareas programadas; se envía como `Authorization: Bearer`   |
| `PENDING_REMINDERS_CRON_SECRET`        | Secreto opcional específico para el cron de recordatorios                          |
| `MONTHLY_STAT_REPORTS_CRON_SECRET`     | Secreto opcional específico para el cron mensual de informes                       |
| `UMAMI_PERSONAL_URL`                   | Umami personal: `https://analytics.187.124.55.36.sslip.io`                         |
| `UMAMI_PERSONAL_USERNAME`              | Usuario API del Umami personal; por defecto `admin`                                |
| `UMAMI_PERSONAL_PASSWORD`              | Contraseña del Umami personal, solo servidor                                       |
| `UMAMI_AGAMA_URL`                      | Umami Agama/TodoPlástico: `https://analytics.2.24.10.239.sslip.io`                  |
| `UMAMI_AGAMA_USERNAME`                 | Usuario API del Umami Agama; por defecto `admin`                                   |
| `UMAMI_AGAMA_PASSWORD`                 | Contraseña del Umami Agama, solo servidor                                          |
| `UMAMI_WEBSITE_ID_*`                   | Website ID por sitio; si falta se intenta resolver por dominio en su instancia     |
| `STAT_REPORT_EMAIL_TO`                 | Destinatario requerido; puede sustituirse explícitamente con `RESEND_TO_EMAIL`     |
| `TODO_PLASTICO_URL`                    | URL Supabase/API del proyecto TodoPlastico                                         |
| `TODO_PLASTICO_SERVICE_KEY`            | Service role key de TodoPlastico, solo servidor                                    |
| `TODO_PLASTICO_ADMIN_URL`              | Login admin exacto: `https://todo-plastico.com/ingresar?next=/admin`                |
| `NEXT_PUBLIC_TODO_PLASTICO_PUBLIC_URL` | Panel de clientes exacto: `https://todo-plastico.com/panel`                         |
| `NEXT_PUBLIC_TODO_PLASTICO_ADMIN_URL`  | Login admin usado desde el lanzador                                                 |
| `SUPERENTRENADOR_URL`                  | URL Supabase/API de Superentrenador                                                |
| `SUPERENTRENADOR_SERVICE_KEY`          | Service role key de Superentrenador, solo servidor                                 |
| `NEXT_PUBLIC_SUPERENTRENADOR_URL`      | URL publica del marketplace Superentrenador                                        |
| `NEXT_PUBLIC_COACH_STUDIO_URL`         | URL publica del panel entrenador/alumno                                            |
| `APPS_USERS_URL`                       | URL Supabase/API de usuarios compartidos de apps educativas                        |
| `APPS_USERS_SERVICE_KEY`               | Service role key de usuarios compartidos, solo servidor                            |
| `IMKONTEXT_URL`                        | URL Supabase/API de imKontext/Vokabel                                              |
| `IMKONTEXT_SERVICE_KEY`                | Service role key de imKontext/Vokabel, solo servidor                               |

> `APP_URL` es ahora la referencia canónica del servidor para auth y callbacks. `NEXT_PUBLIC_APP_URL` debe apuntar al mismo dominio para evitar discrepancias entre servidor y cliente.

> `NEXT_PUBLIC_*` se incrustan en el bundle cliente en build time — deben estar disponibles durante el build en Coolify, no solo en runtime.

> El código mantiene compatibilidad secundaria con `TURNSTILE_SITE_KEY` como fallback legado para `/api/contact/config`, pero la convención principal de producción es `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

> Analytics usa dos orígenes aislados: TodoPlástico pertenece a Agama y los otros 13 sitios al Umami personal. Las lecturas se cachean 300 segundos y un fallo de una instancia no oculta los datos de la otra. `STAT_REPORT_UMAMI_URL`, `STAT_REPORT_UMAMI_USERNAME`, `STAT_REPORT_UMAMI_PASSWORD` y `STAT_REPORT_UMAMI_WEBSITE_ID_*` siguen admitidos únicamente como fallback del origen personal durante la transición.

> La vista editorial carga solo los sitios del panel abierto. La analítica avanzada conserva las vistas en vivo e históricas, eventos y dimensiones, y se carga únicamente al abrirla. La vista avanzada de Superentrenador prioriza `UMAMI_PERSONAL_*` y mantiene `UMAMI_URL`, `UMAMI_USERNAME`, `UMAMI_PASSWORD` y `UMAMI_SUPERENTRENADOR_WEBSITE_ID` como aliases legacy.

> `CONTACT_EMAIL` no existe todavía como variable en esta app. El destinatario del formulario público está fijado en `info@webfuengirola.com` dentro de `src/lib/email.ts`.

### Variables usadas por el formulario público

El flujo público depende de estos endpoints:

- `/api/contact/config`
- `/api/contact`

Variables realmente usadas por ese flujo:

| Variable                         | Endpoint              | Qué pasa si falta                                                                                     |
| -------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `/api/contact/config` | Responde `503 turnstile_not_configured`                                                               |
| `TURNSTILE_SECRET_KEY`           | `/api/contact`        | La validación server-side de Turnstile falla; con token no vacío puede terminar en `500 server_error` |
| `RESEND_API_KEY`                 | `/api/contact`        | El envío por Resend falla                                                                             |
| `RESEND_FROM_EMAIL`              | `/api/contact`        | El envío por Resend falla                                                                             |
| `STAT_REPORT_EMAIL_TO`           | `/api/monthly-stat-reports` | Sin este valor ni `RESEND_TO_EMAIL`, responde `503 stat_report_not_configured`                   |

Fallback legado aceptado por código:

- `TURNSTILE_SITE_KEY` sigue funcionando solo como respaldo secundario si todavía no se ha migrado a `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

### Nota sobre `outputFileTracingRoot`

`next.config.ts` activa `output: 'standalone'`; el Dockerfile ejecuta el `server.js` generado por Next.js.

## Notas de funcionamiento

- `clients.email` es la identidad funcional del cliente en v1.
- `clients.project` segmenta la base entre `wf-studio`, `vivir-fuengirola` y `conoce-fuengirola`.
- `packs` es la única fuente de horas contratadas, incluidas las horas sueltas.
- `remaining_minutes` nunca se persiste: sale de `packs - activities`.
- No se permiten actividades sobre packs inactivos.
- Si el email del cliente cambia desde el panel y existe usuario Auth asociado, la app intenta sincronizarlo con `auth.users`.
- Las integraciones externas renderizan un aviso de conexion pendiente cuando faltan env vars o permisos; no deben romper el shell del panel.
- La configuración de crons, migraciones y recuperación está en [`ADMIN_PANEL_OPERATIONS.md`](ADMIN_PANEL_OPERATIONS.md).

## Auth Runbook

Para la configuración operativa completa de auth, dominios, migraciones y claves necesarias para reutilizar este patrón en otras apps, ver:

- [`AUTH_SETUP.md`](AUTH_SETUP.md)
