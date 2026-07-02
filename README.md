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

1. Entra en la carpeta:

```bash
cd apps/studio-panel
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
```

4. Aplica las migraciones SQL en tu proyecto Supabase:

- carpeta: [`supabase/migrations/`](../../supabase/migrations/)

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

El workflow `.github/workflows/studio-panel-ci.yml` se ejecuta automáticamente en push/PR a `main` cuando cambian archivos bajo `apps/studio-panel/` o `supabase/migrations/`.

Pasos: `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`.

El build funciona sin credenciales reales: las páginas dinámicas (las que usan cookies) no se pre-renderizan en build time, y el acceso a env vars está detrás de funciones lazy. No se necesita configurar secrets en GitHub para que el CI pase.

### Variables de entorno en producción (Coolify)

Configura estas variables en Coolify antes de hacer el primer deploy:

| Variable                               | Descripción                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto Supabase                                                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública (anon key)                                                           |
| `SUPABASE_SECRET_KEY`                  | Service role key (solo servidor)                                                   |
| `APP_URL`                              | URL canónica del panel para magic links, callbacks y metadatos                     |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`       | Site key pública de Cloudflare Turnstile para `/api/contact/config`                |
| `TURNSTILE_SECRET_KEY`                 | Secret key privada de Cloudflare Turnstile para validar el token en `/api/contact` |
| `RESEND_API_KEY`                       | API key de Resend para emails                                                      |
| `RESEND_FROM_EMAIL`                    | Email remitente verificado en Resend                                               |
| `NEXT_PUBLIC_APP_URL`                  | URL pública expuesta al cliente; mantenerla igual que `APP_URL`                    |

> `APP_URL` es ahora la referencia canónica del servidor para auth y callbacks. `NEXT_PUBLIC_APP_URL` debe apuntar al mismo dominio para evitar discrepancias entre servidor y cliente.

> `NEXT_PUBLIC_*` se incrustan en el bundle cliente en build time — deben estar disponibles durante el build en Coolify, no solo en runtime.

> El código mantiene compatibilidad secundaria con `TURNSTILE_SITE_KEY` como fallback legado para `/api/contact/config`, pero la convención principal de producción es `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

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

Fallback legado aceptado por código:

- `TURNSTILE_SITE_KEY` sigue funcionando solo como respaldo secundario si todavía no se ha migrado a `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

### Nota sobre `outputFileTracingRoot`

`next.config.ts` define `outputFileTracingRoot` apuntando a la raíz del repo (`../../` desde `apps/studio-panel/`). Esto es relevante solo si se activa `output: 'standalone'` en el futuro. Con el build por defecto no tiene efecto.

## Notas de funcionamiento

- `clients.email` es la identidad funcional del cliente en v1.
- `clients.project` segmenta la base entre `wf-studio`, `vivir-fuengirola` y `conoce-fuengirola`.
- `packs` es la única fuente de horas contratadas, incluidas las horas sueltas.
- `remaining_minutes` nunca se persiste: sale de `packs - activities`.
- No se permiten actividades sobre packs inactivos.
- Si el email del cliente cambia desde el panel y existe usuario Auth asociado, la app intenta sincronizarlo con `auth.users`.
