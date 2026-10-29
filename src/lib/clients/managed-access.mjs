import { randomBytes as cryptoRandomBytes } from 'node:crypto'

const PASSWORD_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const PASSWORD_LENGTH = 20
const MANAGED_ACCESS_PROJECTS = new Set([
  'wf-studio',
  'vivir-fuengirola',
  'vivir-fuengirola-negocios',
  'conoce-fuengirola',
])

export function generateTemporaryPassword(randomBytes = cryptoRandomBytes) {
  const entropy = randomBytes(PASSWORD_LENGTH)
  if (!Buffer.isBuffer(entropy) || entropy.length < PASSWORD_LENGTH) {
    throw new Error('Insufficient password entropy')
  }

  return Array.from(entropy.subarray(0, PASSWORD_LENGTH), (byte) => PASSWORD_ALPHABET[byte & 31]).join('')
}

export function resolveManagedAccess({ client, profile }) {
  if (!client || client.status !== 'active') return { status: 'blocked', reason: 'inactive-client' }
  if (!MANAGED_ACCESS_PROJECTS.has(client.project)) return { status: 'blocked', reason: 'wrong-project' }
  if (!profile) return { status: 'missing' }
  if (profile.role === 'admin') return { status: 'blocked', reason: 'admin-profile' }
  if (profile.role !== 'client') return { status: 'blocked', reason: 'invalid-role' }
  if (profile.email?.trim().toLowerCase() !== client.email.trim().toLowerCase()) {
    return { status: 'blocked', reason: 'email-mismatch' }
  }
  return { status: 'ready', authUserId: profile.id }
}
