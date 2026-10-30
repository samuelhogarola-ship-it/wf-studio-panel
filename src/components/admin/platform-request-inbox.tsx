'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { approvePlatformRequestAction, rejectPlatformRequestAction } from '@/lib/actions/platform-requests'
import type { PlatformRequestListItem } from '@/lib/platform-requests/admin'
import type { Json, PlatformRequestStatus, PlatformRequestType } from '@/lib/supabase/types'

type InboxScope = 'vivir-clients' | 'vivir-businesses' | 'conoce'

const TYPE_LABELS = {
  client: 'Cliente',
  business: 'Negocio',
  subscription_interest: 'Interés en suscripción',
} as const

const STATUS_LABELS: Record<PlatformRequestStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
}

function scopeConfig(scope: InboxScope) {
  if (scope === 'conoce') return { base: '/paneladmin/conoce-fuengirola/solicitudes', scopeValue: null }
  return {
    base: '/paneladmin/vivir-en-fuengirola/solicitudes',
    scopeValue: scope === 'vivir-businesses' ? 'businesses' : 'clients',
  }
}

function hrefFor(scope: InboxScope, values: Record<string, string | undefined>) {
  const config = scopeConfig(scope)
  const params = new URLSearchParams()
  if (config.scopeValue) params.set('scope', config.scopeValue)
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value)
  const query = params.toString()
  return query ? `${config.base}?${query}` : config.base
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC' }).format(new Date(value))
}

function flattenProfile(value: Json, prefix = ''): Array<[string, string]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value).flatMap(([key, child]) => {
    const label = prefix ? `${prefix} · ${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) return flattenProfile(child, label)
    return [[label, child === null ? '—' : String(child)]]
  })
}

function ReviewActions({ requestId, requestType }: { requestId: string; requestType: PlatformRequestType }) {
  const [approveState, approveAction, approvePending] = useActionState(approvePlatformRequestAction, {})
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectPlatformRequestAction, {})
  const clientHref = approveState.clientHref
  const profileHref = approveState.profileHref

  return (
    <div className="grid gap-4 border-t border-line pt-5 lg:grid-cols-2">
      <form action={approveAction} className="rounded-2xl bg-emerald-50 p-4">
        <input type="hidden" name="request_id" value={requestId} />
        <p className="mb-3 text-sm text-emerald-900">{requestType === 'business'
          ? 'Crea una ficha canónica en borrador para revisión. No se publica hasta usar la acción de publicación.'
          : 'Incorpora o enlaza esta ficha en el CRM. El acceso del cliente se crea después desde su ficha.'}</p>
        <button disabled={approvePending} className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{approvePending ? 'Aprobando…' : 'Aprobar'}</button>
        {approveState.error || approveState.success ? <p role={approveState.error ? 'alert' : 'status'} className="mt-3 text-sm">{approveState.error ?? approveState.success}</p> : null}
        {clientHref ? <Link href={clientHref} className="mt-3 block text-sm font-semibold text-emerald-800 underline">Abrir ficha del cliente</Link> : null}
        {profileHref ? <Link href={profileHref} className="mt-3 block text-sm font-semibold text-emerald-800 underline">Abrir ficha para revisión</Link> : null}
      </form>
      <form action={rejectAction} className="rounded-2xl bg-rose-50 p-4">
        <input type="hidden" name="request_id" value={requestId} />
        <label htmlFor={`reason-${requestId}`} className="text-sm font-semibold text-rose-900">Motivo opcional</label>
        <textarea id={`reason-${requestId}`} name="reason" maxLength={500} className="mt-2 min-h-20 w-full rounded-xl border border-rose-200 bg-white p-3 text-sm" />
        <button disabled={rejectPending} className="mt-3 rounded-full bg-rose-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{rejectPending ? 'Rechazando…' : 'Rechazar'}</button>
        {rejectState.error || rejectState.success ? <p role={rejectState.error ? 'alert' : 'status'} className="mt-3 text-sm">{rejectState.error ?? rejectState.success}</p> : null}
      </form>
    </div>
  )
}

function RequestDetail({ scope, request, query, status, page }: {
  scope: InboxScope
  request: PlatformRequestListItem
  query: string
  status: string
  page: number
}) {
  const profile = flattenProfile(request.profile_data)
  let origin = request.source_url ?? '—'
  try { if (request.source_url) origin = new URL(request.source_url).hostname } catch { /* stored historic value */ }

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <Link href={hrefFor(scope, { q: query, status, page: String(page) })} className="text-sm font-semibold text-brand">← Volver a solicitudes</Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-wider text-muted">{TYPE_LABELS[request.request_type]}</p><h2 className="mt-1 text-2xl font-black text-foreground">{request.name}</h2><p className="text-sm text-muted">{request.email}</p></div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{STATUS_LABELS[request.status]}</span>
      </div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ['Empresa', request.company || '—'], ['Teléfono', request.phone || '—'], ['Origen', origin],
          ['Recibida', formatDate(request.created_at)], ['Mensaje', request.message || '—'],
        ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><dt className="text-xs font-bold uppercase tracking-wider text-muted">{label}</dt><dd className="mt-1 break-words text-sm text-foreground">{value}</dd></div>)}
      </dl>
      {profile.length > 0 ? <div className="mt-6"><h3 className="font-bold text-foreground">Ficha recibida</h3><dl className="mt-3 grid gap-3 sm:grid-cols-2">{profile.map(([label, value]) => <div key={label} className="rounded-xl border border-line p-3"><dt className="text-xs font-semibold text-muted">{label}</dt><dd className="mt-1 break-words text-sm">{value}</dd></div>)}</dl></div> : null}
      {request.status === 'pending' ? <ReviewActions requestId={request.id} requestType={request.request_type} /> : null}
      {request.status !== 'pending' ? (
        <div className={`mt-6 rounded-2xl p-4 text-sm ${request.status === 'approved' ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}>
          <p className="font-bold">{request.status === 'approved' ? 'Solicitud aprobada' : 'Solicitud rechazada'}</p>
          {request.reviewed_at ? <p className="mt-1">Resuelta el {formatDate(request.reviewed_at)}.</p> : null}
          {request.rejection_reason ? <p className="mt-2">Motivo: {request.rejection_reason}</p> : null}
        </div>
      ) : null}
      {request.converted_client_id ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/paneladmin/clientes/${request.converted_client_id}`} className="inline-flex rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white">Abrir cliente relacionado</Link>
          {request.request_type === 'subscription_interest' ? <Link href={`/paneladmin/bonos?new=1&tab=packs&type=subscription&client=${request.converted_client_id}`} className="inline-flex rounded-full border border-brand px-5 py-2 text-sm font-semibold text-brand">Preparar suscripción</Link> : null}
        </div>
      ) : null}
    </section>
  )
}

export function PlatformRequestInbox({ scope, data, query, status, page }: {
  scope: InboxScope
  data: { requests: PlatformRequestListItem[]; selectedRequest: PlatformRequestListItem | null; page?: number; pageSize?: number; total?: number }
  query: string
  status: string
  page?: number
}) {
  const config = scopeConfig(scope)
  const currentPage = data.page ?? page ?? 1
  if (data.selectedRequest) return <RequestDetail scope={scope} request={data.selectedRequest} query={query} status={status} page={currentPage} />
  const pageSize = data.pageSize ?? 50
  const totalPages = Math.max(1, Math.ceil((data.total ?? data.requests.length) / pageSize))

  return (
    <div>
      {scope !== 'conoce' ? <div className="mb-4 flex gap-2"><Link href={`${config.base}?scope=clients`} aria-current={scope === 'vivir-clients' ? 'page' : undefined} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold">Clientes</Link><Link href={`${config.base}?scope=businesses`} aria-current={scope === 'vivir-businesses' ? 'page' : undefined} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold">Negocios</Link></div> : null}
      <form action={config.base} className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-line bg-white p-3">
        {config.scopeValue ? <input type="hidden" name="scope" value={config.scopeValue} /> : null}
        <input type="search" name="q" defaultValue={query} placeholder="Buscar nombre, email o empresa…" className="min-w-64 flex-1 rounded-xl border border-line px-4 py-2 text-sm" />
        <select name="status" defaultValue={status} className="rounded-xl border border-line px-4 py-2 text-sm"><option value="pending">Pendientes</option><option value="approved">Aprobadas</option><option value="rejected">Rechazadas</option><option value="all">Todas</option></select>
        <button className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white">Filtrar</button>
      </form>
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-muted"><tr><th className="px-5 py-4">Solicitud</th><th className="px-5 py-4">Tipo</th><th className="px-5 py-4">Fecha</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4"></th></tr></thead><tbody className="divide-y divide-line">{data.requests.map((item) => <tr key={item.id}><td className="px-5 py-4"><p className="font-semibold">{item.name}</p><p className="text-xs text-muted">{item.company || item.email}</p></td><td className="px-5 py-4">{TYPE_LABELS[item.request_type]}</td><td className="px-5 py-4">{formatDate(item.created_at)}</td><td className="px-5 py-4">{STATUS_LABELS[item.status]}</td><td className="px-5 py-4"><Link href={hrefFor(scope, { q: query, status, page: String(currentPage), request: item.id })} className="font-semibold text-brand">Ver ficha</Link></td></tr>)}</tbody></table>{data.requests.length === 0 ? <p className="px-6 py-10 text-sm text-muted">No hay solicitudes con estos filtros.</p> : null}</div>
        {totalPages > 1 ? <nav aria-label="Paginación de solicitudes" className="flex items-center justify-between border-t border-line px-5 py-4 text-sm"><span>Página {currentPage} de {totalPages}</span><div className="flex gap-2">{currentPage > 1 ? <Link href={hrefFor(scope, { q: query, status, page: String(currentPage - 1) })} className="rounded-full border border-line px-4 py-2 font-semibold">Anterior</Link> : null}{currentPage < totalPages ? <Link href={hrefFor(scope, { q: query, status, page: String(currentPage + 1) })} className="rounded-full border border-line px-4 py-2 font-semibold">Siguiente</Link> : null}</div></nav> : null}
      </div>
    </div>
  )
}
