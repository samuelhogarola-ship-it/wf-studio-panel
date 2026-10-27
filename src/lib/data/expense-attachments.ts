const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

const signatures: Record<string, (bytes: Uint8Array) => boolean> = {
  'application/pdf': bytes => bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46,
  'image/jpeg': bytes => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  'image/png': bytes => bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value),
  'image/webp': bytes => bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP',
}

export function validateExpenseAttachment(bytes: Uint8Array, contentType: string, declaredSize = bytes.length) {
  if (declaredSize < 1 || declaredSize > MAX_ATTACHMENT_BYTES) return { valid: false as const, error: 'El archivo debe ocupar como máximo 10 MB.' }
  const matches = signatures[contentType]?.(bytes) ?? false
  return matches ? { valid: true as const } : { valid: false as const, error: 'Adjunta un PDF, JPG, PNG o WebP válido.' }
}

export function expenseAttachmentExtension(contentType: string) {
  return ({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[contentType]
}
