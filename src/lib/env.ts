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
