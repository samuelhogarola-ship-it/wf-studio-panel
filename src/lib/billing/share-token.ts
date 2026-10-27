import { createHash, randomBytes } from 'node:crypto'

export function hashBillingShareToken(rawToken: string) {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex')
}

export function createBillingShareToken() {
  const rawToken = randomBytes(32).toString('hex')
  return { rawToken, tokenHash: hashBillingShareToken(rawToken) }
}
