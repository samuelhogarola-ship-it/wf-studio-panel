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
RESEND_API_KEY=
RESEND_FROM_EMAIL=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Aplica la migración SQL en tu proyecto Supabase:

- archivo: [`supabase/migrations/202606210001_studio_panel.sql`](../../supabase/migrations/202606210001_studio_panel.sql)

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

Pasos: `npm ci` → `npm run lint` → `npm run typecheck` → `npm run build`.

El build funciona sin credenciales reales: las páginas dinámicas (las que usan cookies) no se pre-renderizan en build time, y el acceso a env vars está detrás de funciones lazy. No se necesita configurar secrets en GitHub para que el CI pase.

### Variables de entorno en producción (Coolify)

Configura estas variables en Coolify antes de hacer el primer deploy:

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública (anon key) |
| `SUPABASE_SECRET_KEY` | Service role key (solo servidor) |
| `RESEND_API_KEY` | API key de Resend para emails |
| `RESEND_FROM_EMAIL` | Email remitente verificado en Resend |
| `NEXT_PUBLIC_APP_URL` | URL pública de la app (ej. `https://panel.wf-studio.com`) |

> `NEXT_PUBLIC_*` se incrustan en el bundle cliente en build time — deben estar disponibles durante el build en Coolify, no solo en runtime.

### Nota sobre `outputFileTracingRoot`

`next.config.ts` define `outputFileTracingRoot` apuntando a la raíz del repo (`../../` desde `apps/studio-panel/`). Esto es relevante solo si se activa `output: 'standalone'` en el futuro. Con el build por defecto no tiene efecto.

## Notas de funcionamiento

- `clients.email` es la identidad funcional del cliente en v1.
- `packs` es la única fuente de horas contratadas, incluidas las horas sueltas.
- `remaining_hours` nunca se persiste: sale de `packs - activities`.
- No se permiten actividades sobre packs inactivos.
- Si el email del cliente cambia desde el panel y existe usuario Auth asociado, la app intenta sincronizarlo con `auth.users`.
