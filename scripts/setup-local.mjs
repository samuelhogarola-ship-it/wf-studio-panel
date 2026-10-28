import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { chmod, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { resolve } from 'node:path'

import { createClient } from '@supabase/supabase-js'

const exec = promisify(execFile)
const root = fileURLToPath(new URL('../', import.meta.url))

export function parseSupabaseEnv(output) {
  return Object.fromEntries(
    String(output)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map((line) => {
        const separator = line.indexOf('=')
        const key = line.slice(0, separator)
        const rawValue = line.slice(separator + 1)
        const value = rawValue.startsWith('"') && rawValue.endsWith('"')
          ? rawValue.slice(1, -1).replaceAll('\\"', '"')
          : rawValue
        return [key, value]
      }),
  )
}

function envLine(key, value) {
  return `${key}=${JSON.stringify(String(value))}`
}

export function buildLocalEnv(supabase, options = {}) {
  for (const key of ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
    if (!supabase[key]) throw new Error(`Supabase local no devolvió ${key}.`)
  }

  const appUrl = options.appUrl ?? 'http://localhost:3000'
  const adminEmail = options.adminEmail ?? 'admin@wf-panel.local'
  const adminPassword = options.adminPassword ?? 'WFPanelLocal2026!'
  const randomSecret = options.randomSecret ?? (() => randomBytes(32).toString('base64url'))
  const values = {
    NEXT_PUBLIC_SUPABASE_URL: supabase.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.ANON_KEY,
    SUPABASE_SECRET_KEY: supabase.SERVICE_ROLE_KEY,
    APP_URL: appUrl,
    NEXT_PUBLIC_APP_URL: appUrl,
    PROJECT_PROVISIONING_SECRET: randomSecret(),
    CRON_SECRET: randomSecret(),
    WF_SUPPORT_PREVIEW_ENABLED: 'true',
    LOCAL_ADMIN_EMAIL: adminEmail,
    LOCAL_ADMIN_PASSWORD: adminPassword,
  }

  return `${Object.entries(values).map(([key, value]) => envLine(key, value)).join('\n')}\n`
}

export async function writeLocalEnv(path, contents) {
  await writeFile(path, contents, { mode: 0o600 })
  await chmod(path, 0o600)
}

async function run(command, args) {
  try {
    return await exec(command, args, {
      cwd: root,
      env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: 'true', DO_NOT_TRACK: '1' },
      maxBuffer: 10 * 1024 * 1024,
    })
  } catch (error) {
    const detail = String(error?.stderr || error?.message || '').trim()
    throw new Error(detail || `No se pudo ejecutar ${command}.`)
  }
}

async function ensureLocalAdmin(supabase, email, password) {
  const admin = createClient(supabase.API_URL, supabase.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  let userId = created.data.user?.id ?? null

  if (!userId && created.error?.message.toLowerCase().includes('already registered')) {
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    userId = listed.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id ?? null
    if (userId) {
      const updated = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true })
      if (updated.error) throw updated.error
    }
  } else if (created.error) {
    throw created.error
  }

  if (!userId) throw new Error('No se pudo resolver el administrador local.')
  const { error: profileError } = await admin.from('profiles').update({ role: 'admin', email }).eq('id', userId)
  if (profileError) throw profileError
}

export async function setupLocal() {
  await run('docker', ['info'])
  await run('npx', ['supabase', 'start'])
  const { stdout } = await run('npx', ['supabase', 'status', '-o', 'env'])
  const supabase = parseSupabaseEnv(stdout)
  const contents = buildLocalEnv(supabase)
  const values = parseSupabaseEnv(contents)
  await writeLocalEnv(resolve(root, '.env.local'), contents)
  await ensureLocalAdmin(supabase, values.LOCAL_ADMIN_EMAIL, values.LOCAL_ADMIN_PASSWORD)

  return {
    appUrl: values.APP_URL,
    adminEmail: values.LOCAL_ADMIN_EMAIL,
    adminPassword: values.LOCAL_ADMIN_PASSWORD,
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  setupLocal()
    .then(({ appUrl, adminEmail, adminPassword }) => {
      console.log('WF Panel local preparado.')
      console.log(`Panel: ${appUrl}/paneladmin`)
      console.log(`Usuario local: ${adminEmail}`)
      console.log(`Contraseña local: ${adminPassword}`)
      console.log('Arranca la aplicación con: npm run dev')
    })
    .catch((error) => {
      console.error(`No se pudo preparar WF Panel local: ${error instanceof Error ? error.message : 'error desconocido'}`)
      process.exitCode = 1
    })
}
