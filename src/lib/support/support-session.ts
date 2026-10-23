import 'server-only'
import { createHash, randomBytes as cryptoRandomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPPORT_COOKIE_NAME } from '@/lib/support/constants'
import type { Database, SupportEndReason, SupportSessionRow } from '@/lib/supabase/types'

export { SUPPORT_COOKIE_NAME } from '@/lib/support/constants'

export type SupportSessionContext = {
  id: string
  adminUserId: string
  clientId: string
  returnPath: string
  startedAt: string
  expiresAt: string
}

type DatabaseClient = SupabaseClient<Database>
type SessionInput = { adminUserId: string; token: string | null | undefined }
type TestOptions = { now?: () => Date; randomBytes?: (size: number) => Uint8Array }
const maxAge = 30 * 60
const returnPathPattern = /^\/paneladmin\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/
const reasons: readonly SupportEndReason[] = ['manual', 'expired', 'replaced', 'client_inactive', 'access_revoked']

function validToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token) && Buffer.from(token, 'base64url').toString('base64url') === token
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function validReturnPath(value: string) {
  return returnPathPattern.test(value) && !/[\r\n]/.test(value)
}

function context(row: SupportSessionRow): SupportSessionContext {
  return { id: row.id, adminUserId: row.admin_user_id, clientId: row.client_id, returnPath: row.return_path, startedAt: row.started_at, expiresAt: row.expires_at }
}

async function activeClient(db: DatabaseClient, clientId: string) {
  const { data, error } = await db.from('clients').select('id').eq('id', clientId).eq('status', 'active').eq('project', 'wf-studio').maybeSingle()
  return !error && Boolean(data)
}

export async function createSupportSession(
  db: DatabaseClient,
  input: { adminUserId: string; clientId: string; returnPath: string },
  options: TestOptions = {},
): Promise<{ token: string; session: SupportSessionContext }> {
  if (!validReturnPath(input.returnPath)) throw new Error('Invalid return path')
  if (!await activeClient(db, input.clientId)) throw new Error('Active client required')
  const token = Buffer.from((options.randomBytes ?? cryptoRandomBytes)(32)).toString('base64url')
  if (!validToken(token)) throw new Error('Invalid support token')
  const { data, error } = await db.rpc('start_admin_support_session', {
    p_client_id: input.clientId,
    p_token_hash: tokenHash(token),
    p_return_path: input.returnPath,
  })
  const row = data?.[0]
  if (error || !row || row.admin_user_id !== input.adminUserId || row.client_id !== input.clientId) throw new Error('Unable to start support session')
  return { token, session: context(row) }
}

export async function resolveSupportSession(db: DatabaseClient, input: SessionInput, options: TestOptions = {}): Promise<SupportSessionContext | null> {
  if (!validToken(input.token)) return null
  const { data: row, error } = await db.from('admin_support_sessions').select('*')
    .eq('token_hash', tokenHash(input.token)).eq('admin_user_id', input.adminUserId).is('ended_at', null).maybeSingle()
  if (error || !row || !validReturnPath(row.return_path)) return null
  const now = (options.now ?? (() => new Date()))().getTime()
  const expiresAt = Date.parse(row.expires_at)
  const startedAt = Date.parse(row.started_at)
  if (!Number.isFinite(expiresAt) || !Number.isFinite(startedAt) || expiresAt <= startedAt || expiresAt - startedAt > maxAge * 1000) return null
  if (expiresAt <= now) {
    await endSupportSession(db, input, 'expired')
    return null
  }
  if (!await activeClient(db, row.client_id)) {
    await endSupportSession(db, input, 'client_inactive')
    return null
  }
  return context(row)
}

export async function endSupportSession(db: DatabaseClient, input: SessionInput, reason: SupportEndReason): Promise<boolean> {
  if (!reasons.includes(reason)) throw new Error('Invalid end reason')
  if (!validToken(input.token)) return false
  const { data, error } = await db.rpc('end_admin_support_session', { p_token_hash: tokenHash(input.token), p_reason: reason })
  if (error) throw new Error('Unable to end support session')
  return data === true
}

function cookie(value: string, seconds: number) {
  return { name: SUPPORT_COOKIE_NAME, value, httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: Number.isFinite(seconds) ? Math.max(0, Math.min(maxAge, Math.floor(seconds))) : 0 }
}

export function supportCookie(token: string, maxAgeSeconds: number) {
  if (!validToken(token)) throw new Error('Invalid support token')
  return cookie(token, maxAgeSeconds)
}

export function clearSupportCookie() {
  return cookie('', 0)
}
