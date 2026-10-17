export function getTurnstileConfig(env = process.env) {
  const siteKey =
    env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || env.TURNSTILE_SITE_KEY || ''
  const secretKey = env.TURNSTILE_SECRET_KEY || ''
  const enabled = Boolean(siteKey && secretKey)

  return {
    enabled,
    siteKey: enabled ? siteKey : '',
    secretKey: enabled ? secretKey : '',
  }
}

export function createContactRateLimiter({
  limit = 5,
  windowMs = 10 * 60 * 1000,
  now = () => Date.now(),
} = {}) {
  const requests = new Map()

  return {
    allow(key) {
      const currentTime = now()
      const cutoff = currentTime - windowMs
      const recent = (requests.get(key) || []).filter(
        (timestamp) => timestamp > cutoff,
      )

      if (recent.length >= limit) {
        requests.set(key, recent)
        return false
      }

      recent.push(currentTime)
      requests.set(key, recent)
      return true
    },
  }
}
