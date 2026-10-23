import 'server-only'

import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getOptionalIdentity, requireClientAccess, type AuthIdentity, type ClientIdentity } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  SUPPORT_COOKIE_NAME,
  endSupportSession,
  resolveSupportSession,
} from '@/lib/support/support-session'
import type { Database, SupportEndReason, Tables } from '@/lib/supabase/types'

type Client = Pick<Tables<'clients'>, 'id' | 'email' | 'status' | 'name' | 'portal_mode'>
type SessionDatabase = SupabaseClient<Database>
export type SupportClearReason = Extract<SupportEndReason, 'expired' | 'client_inactive' | 'access_revoked'>

export type ClientViewer = {
  mode: 'client'
  identity: ClientIdentity
  client: Client
}

export type SupportViewer = {
  mode: 'support'
  identity: AuthIdentity & { role: 'admin' }
  client: Client
  supportSessionId: string
  expiresAt: string
  returnPath: string
}

export type PortalViewer = ClientViewer | SupportViewer

const fallbackReturnPath = '/paneladmin/inicio'
const clearReasons: readonly SupportClearReason[] = ['expired', 'client_inactive', 'access_revoked']
const supportStatusValues = new Set(clearReasons)
const supportPathPattern = /^\/paneladmin\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/

function isCanonicalToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token) && Buffer.from(token, 'base64url').toString('base64url') === token
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function normalizeSupportReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallbackReturnPath
  if (/[\\#\r\n%]/.test(value) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(value)) return fallbackReturnPath
  let parsed: URL
  try {
    parsed = new URL(value, 'https://support-return.invalid')
  } catch {
    return fallbackReturnPath
  }
  if (parsed.origin !== 'https://support-return.invalid' || !supportPathPattern.test(parsed.pathname)) return fallbackReturnPath
  const entries = [...parsed.searchParams.entries()]
  if (entries.some(([key, status]) => key !== 'supportPreview' || !supportStatusValues.has(status as SupportClearReason))) return fallbackReturnPath
  if (entries.length > 1) return fallbackReturnPath
  return `${parsed.pathname}${parsed.search}`
}

function clearReason(value: unknown): SupportClearReason {
  return clearReasons.includes(value as SupportClearReason) ? value as SupportClearReason : 'access_revoked'
}

function clearRoute() {
  return '/api/support-preview/clear'
}

async function loadActiveClient(db: SessionDatabase, clientId: string): Promise<Client | null> {
  const { data, error } = await db.from('clients').select('id, email, status, name, portal_mode')
    .eq('id', clientId).eq('project', 'wf-studio').eq('status', 'active').maybeSingle()
  return error ? null : data
}

async function resolveAdminSupportViewer(identity: AuthIdentity & { role: 'admin' }, token: string): Promise<SupportViewer | null> {
  const db = await createSupabaseServerClient()
  const session = await resolveSupportSession(db, { adminUserId: identity.userId, token })
  if (!session) return null
  const client = await loadActiveClient(db, session.clientId)
  if (!client) return null
  return {
    mode: 'support',
    identity,
    client,
    supportSessionId: session.id,
    expiresAt: session.expiresAt,
    returnPath: normalizeSupportReturnPath(session.returnPath),
  }
}

export async function requirePortalViewer(): Promise<PortalViewer> {
  const identity = await getOptionalIdentity()
  if (!identity || identity.role === 'client') {
    const clientIdentity = await requireClientAccess() as ClientIdentity
    return { mode: 'client', identity: clientIdentity, client: clientIdentity.client }
  }
  if (identity.role !== 'admin') redirect(fallbackReturnPath)

  const token = (await cookies()).get(SUPPORT_COOKIE_NAME)?.value
  if (!token) redirect(fallbackReturnPath)
  if (process.env.WF_SUPPORT_PREVIEW_ENABLED !== 'true') redirect(clearRoute())

  const viewer = await resolveAdminSupportViewer(identity as AuthIdentity & { role: 'admin' }, token)
  if (!viewer) redirect(clearRoute())
  return viewer
}

export async function getOptionalSupportViewer(): Promise<SupportViewer | null> {
  const identity = await getOptionalIdentity()
  if (!identity || identity.role !== 'admin') return null
  const token = (await cookies()).get(SUPPORT_COOKIE_NAME)?.value
  if (!token) return null
  if (process.env.WF_SUPPORT_PREVIEW_ENABLED !== 'true') redirect(clearRoute())
  const viewer = await resolveAdminSupportViewer(identity as AuthIdentity & { role: 'admin' }, token)
  if (!viewer) redirect(clearRoute())
  return viewer
}

export async function requireClientMutationAccess(): Promise<ClientViewer> {
  const viewer = await requirePortalViewer()
  if (viewer.mode === 'support') throw new Error('Support preview is read-only')
  return viewer
}

type SupportSessionClearRow = Pick<Tables<'admin_support_sessions'>, 'client_id' | 'return_path' | 'expires_at' | 'ended_at' | 'end_reason'>

export async function resolveSupportClearRedirect(
  db: SessionDatabase,
  input: { adminUserId: string; token: string | null | undefined },
): Promise<{ returnPath: string; reason: SupportClearReason }> {
  if (!isCanonicalToken(input.token)) return { returnPath: fallbackReturnPath, reason: 'access_revoked' }
  const { data, error } = await db.from('admin_support_sessions').select('client_id, return_path, expires_at, ended_at, end_reason')
    .eq('token_hash', hashToken(input.token)).eq('admin_user_id', input.adminUserId).maybeSingle()
  const row = error ? null : data as SupportSessionClearRow | null
  let reason: SupportClearReason = row?.ended_at ? clearReason(row.end_reason) : 'access_revoked'
  if (row && !row.ended_at) {
    if (Date.parse(row.expires_at) <= Date.now()) reason = 'expired'
    else {
      const { data: activeClient, error: clientError } = await db.from('clients').select('id')
        .eq('id', row.client_id).eq('project', 'wf-studio').eq('status', 'active').maybeSingle()
      if (!clientError && !activeClient) reason = 'client_inactive'
    }
    await endSupportSession(db, { adminUserId: input.adminUserId, token: input.token }, reason)
  }
  return { returnPath: normalizeSupportReturnPath(row?.return_path), reason }
}
