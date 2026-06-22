const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
}

export function isPublicEnvConfigured() {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseKey && publicEnv.appUrl)
}

export function getPublicEnv() {
  return publicEnv
}

export function getRequiredServerEnv(name: keyof NodeJS.ProcessEnv) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}
