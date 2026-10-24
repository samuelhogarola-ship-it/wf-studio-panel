export const SUPPORT_READ_ONLY_MESSAGE = 'No disponible en modo soporte.'

export const SUPPORT_READ_ONLY_ACTION_RESULT = {
  ok: false,
  error: 'support_readonly',
  message: SUPPORT_READ_ONLY_MESSAGE,
} as const

export type SupportReadOnlyActionResult = typeof SUPPORT_READ_ONLY_ACTION_RESULT

export class SupportReadOnlyError extends Error {
  readonly code = 'support_readonly' as const
  readonly status = 403 as const

  constructor() {
    super(SUPPORT_READ_ONLY_MESSAGE)
    this.name = 'SupportReadOnlyError'
  }
}

export function isSupportReadOnlyError(error: unknown): error is SupportReadOnlyError {
  return error instanceof SupportReadOnlyError || (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'support_readonly'
    && 'status' in error
    && error.status === 403
  )
}
