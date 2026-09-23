export function canReadResource(identity, clientId) {
  return Boolean(identity && (identity.role === 'admin' || (identity.role === 'client' && identity.clientId === clientId)))
}
export function validateImage(bytes, type) {
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) return false
  const hex = Buffer.from(bytes.subarray(0, 12)).toString('hex')
  if (type === 'image/jpeg') return hex.startsWith('ffd8ff')
  if (type === 'image/png') return hex.startsWith('89504e470d0a1a0a')
  if (type === 'image/webp') return hex.startsWith('52494646') && hex.slice(16) === '57454250'
  return false
}
