import type { Tables } from '@/lib/supabase/types'
export function ResourceList({ items }: { items: Tables<'client_resources'>[] }) {
  if (!items.length) return <p className="rounded-xl border border-line bg-white p-6 text-muted">Todavía no hay contenido en esta sección.</p>
  return <div className="grid gap-4">{items.map(item => <article key={item.id} className="rounded-xl border border-line bg-white p-5">
    <time className="text-xs text-muted" dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString('es-ES', { timeZone: 'UTC' })}</time>
    <h2 className="mt-1 text-xl font-bold">{item.title}</h2>
    <p className="my-3 whitespace-pre-wrap">{item.body}</p>
    {item.report_path && <a className="font-semibold text-brand underline" href={item.report_path}>Abrir y descargar informe</a>}
    {item.kind === 'photo' && <>
      {/* Private authenticated route; these images must not use the public Next image cache. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/client-resources/${item.id}`} alt={item.title} className="max-h-96 max-w-full rounded-lg object-contain" loading="lazy" />
      <a className="mt-3 inline-block text-brand underline" href={`/api/client-resources/${item.id}?download=1`}>Descargar fotografía</a>
    </>}
  </article>)}</div>
}
