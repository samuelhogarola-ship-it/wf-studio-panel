# Auth Setup Runbook

Guía operativa para que el login cliente, magic link, reset de contraseña y logout funcionen en `apps/studio-panel` y sirva de referencia para otras apps del mismo Supabase.

## Proyecto Supabase correcto

Este panel está funcionando contra el proyecto Supabase que emite enlaces como:

- `https://iaglqispczaoduoodzwx.supabase.co/auth/v1/verify?...`

Antes de tocar datos, usuarios o plantillas, comprueba que estás en ese proyecto y no en otro.

## Variables de entorno obligatorias

En Coolify y en local, esta app necesita:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
APP_URL=
NEXT_PUBLIC_APP_URL=
```

Valores esperados en producción para el portal cliente:

```bash
APP_URL=https://portal.webfuengirola.com
NEXT_PUBLIC_APP_URL=https://portal.webfuengirola.com
```

Notas:

- `NEXT_PUBLIC_SUPABASE_URL` debe apuntar al mismo proyecto Supabase real que usa el portal.
- `SUPABASE_SECRET_KEY` es la service role key del mismo proyecto.
- `APP_URL` y `NEXT_PUBLIC_APP_URL` no deben apuntar a `localhost`.
- Si una app usa dominio distinto, esos dos valores deben cambiar a su dominio real.

## Supabase Dashboard

En `Authentication -> URL Configuration`:

- `Site URL`: `https://portal.webfuengirola.com`
- `Redirect URLs` debe incluir al menos:
  - `https://portal.webfuengirola.com/**`
  - `https://admin.webfuengirola.com/**` si el mismo proyecto también sirve admin auth

En `Authentication -> Emails -> Magic link or OTP`:

- usar `{{ .ConfirmationURL }}`

## Migraciones críticas para auth

Estas migraciones son especialmente importantes para que el flujo cliente funcione:

- `supabase/migrations/202606210001_studio_panel.sql`
- `supabase/migrations/202606300001_studio_panel_hardening.sql`
- `supabase/migrations/202607100001_clients_unique_per_project.sql`

La última corrige un bug importante: el email del cliente ya no es único globalmente entre todas las apps del mismo proyecto Supabase, sino por `project`.

SQL de la migración final:

```sql
drop index if exists public.clients_email_lower_unique_idx;

create unique index if not exists clients_project_email_lower_unique_idx
on public.clients (project, lower(email));
```

## Reglas actuales del portal cliente

- El portal cliente de esta app usa `project = 'wf-studio'`.
- El login cliente solo admite registros `clients` con:
  - `project = 'wf-studio'`
  - `status = 'active'`
- El registro público crea el cliente como:
  - `project = 'wf-studio'`
  - `status = 'pending'`

Esto implica:

- Si alguien se registra y queda en `pending`, no podrá entrar todavía por magic link o contraseña.
- Si el mismo email existe en otra app/proyecto del mismo Supabase, ya no debe chocar tras aplicar la migración `202607100001_clients_unique_per_project.sql`.

## Cambios técnicos ya hechos en esta app

### 1. Callback de auth estable

Los callbacks ya no dependen del `origin` contaminado por `localhost`, y escriben la sesión en la misma respuesta que hace redirect.

Archivos:

- `src/app/auth/callback/route.ts`
- `src/app/auth/callback/reset/route.ts`
- `src/lib/supabase/server.ts`
- `src/lib/security/redirects.mjs`

### 2. Validación de cliente por proyecto

El acceso cliente se valida contra `clients` filtrando por proyecto:

- `src/lib/auth.ts`
- `src/lib/actions/auth.ts`

### 3. Registro público con admin client

La inserción en `clients` ya no usa el cliente normal con RLS, sino el admin client:

- `src/lib/actions/auth.ts`

### 4. Logout por route handler

El cierre de sesión ya no usa server action desde componentes cliente. Ahora pasa por:

- `src/app/auth/sign-out/route.ts`

y los formularios llaman a:

- `POST /auth/sign-out`

### 5. Diagnóstico visible y logs

Hay mensajes visibles en `/cliente` y `/cliente/recuperar` para errores frecuentes, y logs en:

- auth callback
- reset callback
- login cliente
- registro cliente
- reset password
- update password

## Logs a buscar si vuelve a fallar

En producción, busca estas etiquetas:

- `[auth/callback]`
- `[auth/callback/reset]`
- `[auth/sign-out]`
- `[auth/client]`
- `[auth/client/password]`
- `[auth/client/magic-link]`
- `[auth/client/register]`
- `[auth/client/reset]`
- `[auth/client/update-password]`

## Checklist para duplicar este sistema en otra app

1. Definir un `project` fijo para esa app.
2. Filtrar login y acceso cliente por ese `project`.
3. Usar `APP_URL` y `NEXT_PUBLIC_APP_URL` con el dominio real de esa app.
4. Añadir su dominio a `Auth -> URL Configuration`.
5. Mantener `{{ .ConfirmationURL }}` en la plantilla de email.
6. Confirmar que `clients` usa unicidad por `(project, lower(email))`.
7. Si la app tiene portal cliente, reutilizar el patrón de:
   - callback route
   - reset callback route
   - route de sign out

## Qué comprobar tras desplegar

1. Registro de usuario nuevo.
2. Recepción de magic link.
3. Click en el enlace y entrada directa al portal.
4. Reset de contraseña.
5. Logout sin error client-side.
