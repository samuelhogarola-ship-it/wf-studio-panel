const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
}

export function getPublicEnv() {
  return publicEnv
}

export function getRequiredServerEnv(name: keyof NodeJS.ProcessEnv) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

export function getSupabaseAdminKey(env: NodeJS.ProcessEnv = process.env) {
  const value = env.SUPABASE_SERVICE_ROLE_KEY?.trim() || env.SUPABASE_SECRET_KEY?.trim()

  if (!value) {
    throw new Error('Missing environment variable: SUPABASE_SECRET_KEY')
  }

  return value
}

export function requireFicheroPublishingEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (env.FICHERO_PUBLISHING_ENABLED?.trim().toLowerCase() !== 'true') {
    throw new Error('Fichero publishing is disabled')
  }
}

export function getFicheroDestinationEnv(
  destination: 'vivir' | 'conoce',
  env: NodeJS.ProcessEnv = process.env,
) {
  const urlName = destination === 'vivir'
    ? 'VIVIR_FUENGIROLA_SUPABASE_URL'
    : 'CONOCE_FUENGIROLA_SUPABASE_URL'
  const keyName = destination === 'vivir'
    ? 'VIVIR_FUENGIROLA_SUPABASE_SERVICE_ROLE_KEY'
    : 'CONOCE_FUENGIROLA_SUPABASE_SERVICE_ROLE_KEY'
  const url = env[urlName]?.trim()
  const serviceKey = env[keyName]?.trim()
  if (!url || !serviceKey) throw new Error(`Missing Fichero destination configuration: ${destination}`)
  return { url, serviceKey }
}
