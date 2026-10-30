'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { saveDirectoryProfileAction } from '@/lib/actions/fichero-admin'
import type { DirectoryAdminChannel, DirectoryAdminProfile } from '@/lib/fichero/admin'
import type { DirectoryPlan } from '@/lib/supabase/types'

const channelLabels = { 'vivir-fuengirola': 'Vivir en Fuengirola', 'conoce-fuengirola': 'Conoce Fuengirola' }
const rights = {
  gratis: ['Directorio y búsqueda'],
  pro: ['Directorio y búsqueda', 'Empresa recomendada', 'Contacto directo', 'Estadísticas básicas'],
  premium: ['Directorio y búsqueda', 'Empresa recomendada', 'Contacto directo', 'Miniweb SEO', 'Estadísticas avanzadas', 'Guía editorial'],
}

function text(value: string | null | undefined) { return value ?? '' }
function list(value: string[] | undefined) { return value?.join('\n') ?? '' }

export function ProfileEditor({ catalogKey, profile, channels, duplicates = [] }: {
  catalogKey: string
  profile?: DirectoryAdminProfile | null
  channels: DirectoryAdminChannel[]
  duplicates?: DirectoryAdminProfile[]
}) {
  const [state, action, pending] = useActionState(saveDirectoryProfileAction, {})
  const [plan, setPlan] = useState<DirectoryPlan>(profile?.plan ?? 'gratis')
  const byKey = new Map(channels.map(channel => [channel.channelKey, channel]))
  const shownDuplicates = state.duplicates ?? duplicates
  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="catalogKey" value={catalogKey} />
      {profile ? <input type="hidden" name="profileId" value={profile.id} /> : null}
      <section className="grid gap-4 rounded-2xl border border-line bg-white p-6 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-lg font-black">Identidad y contacto</h2>
        {[['displayName', 'Nombre público'], ['legalName', 'Razón social'], ['cif', 'CIF/NIF'], ['contactEmail', 'Email'], ['phone', 'Teléfono'], ['whatsapp', 'WhatsApp'], ['website', 'Web'], ['canonicalSlug', 'Slug canónico'], ['address', 'Dirección'], ['ownerUserId', 'ID de propietario']].map(([name, label]) => <label key={name} className="text-sm font-semibold">{label}<input name={name} defaultValue={text(profile?.[name as keyof DirectoryAdminProfile] as string | null)} required={name === 'displayName'} className="mt-2 w-full rounded-xl border border-line px-3 py-2 font-normal" /></label>)}
        <label className="text-sm font-semibold">Latitud<input name="latitude" type="number" step="any" defaultValue={profile?.latitude ?? ''} className="mt-2 w-full rounded-xl border border-line px-3 py-2 font-normal" /></label>
        <label className="text-sm font-semibold">Longitud<input name="longitude" type="number" step="any" defaultValue={profile?.longitude ?? ''} className="mt-2 w-full rounded-xl border border-line px-3 py-2 font-normal" /></label>
      </section>
      <section className="grid gap-4 rounded-2xl border border-line bg-white p-6 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-lg font-black">Contenido, categoría y SEO</h2>
        <label className="text-sm font-semibold">Categoría interna<input name="categoryKey" defaultValue={text(profile?.categoryKey)} required className="mt-2 w-full rounded-xl border border-line px-3 py-2 font-normal" /></label>
        <label className="text-sm font-semibold">Categoría pública<input name="categoryLabel" defaultValue={text(profile?.categoryLabel)} required className="mt-2 w-full rounded-xl border border-line px-3 py-2 font-normal" /></label>
        {[['shortDescription', 'Descripción breve'], ['longDescription', 'Descripción completa'], ['seoTitle', 'Título SEO'], ['seoDescription', 'Descripción SEO'], ['neighborhoodKeys', 'Barrios, uno por línea'], ['services', 'Servicios, uno por línea'], ['schedule', 'Horarios, uno por línea'], ['photos', 'Fotos, una URL por línea']].map(([name, label]) => <label key={name} className="text-sm font-semibold sm:col-span-2">{label}<textarea name={name} defaultValue={['neighborhoodKeys', 'services', 'schedule', 'photos'].includes(name) ? list(profile?.[name as keyof DirectoryAdminProfile] as string[]) : text(profile?.[name as keyof DirectoryAdminProfile] as string | null)} className="mt-2 min-h-20 w-full rounded-xl border border-line px-3 py-2 font-normal" /></label>)}
      </section>
      <section className="grid gap-4 rounded-2xl border border-line bg-white p-6 lg:grid-cols-3">
        <div><h2 className="text-lg font-black">Plan</h2><select name="plan" value={plan} onChange={event => setPlan(event.target.value as DirectoryPlan)} className="mt-3 w-full rounded-xl border border-line px-3 py-2"><option value="gratis">Gratis</option><option value="pro">Pro · 5 €</option><option value="premium">Premium · 19 €</option></select></div>
        <div className="lg:col-span-2"><h3 className="font-bold">Vista previa de derechos</h3><ul className="mt-3 grid gap-2 sm:grid-cols-2">{rights[plan].map(item => <li key={item} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">✓ {item}</li>)}</ul></div>
      </section>
      <section className="grid gap-4 rounded-2xl border border-line bg-white p-6 lg:grid-cols-2">
        <h2 className="lg:col-span-2 text-lg font-black">Canales públicos</h2>
        {(['vivir-fuengirola', 'conoce-fuengirola'] as const).map(key => { const channel = byKey.get(key); return <div key={key} className="rounded-xl border border-line p-4"><label className="flex items-center gap-2 font-bold"><input type="checkbox" name={`channel_${key}_enabled`} defaultChecked={channel?.enabled ?? true} />{channelLabels[key]}</label><label className="mt-3 block text-sm font-semibold">Slug público<input name={`channel_${key}_slug`} defaultValue={channel?.publicSlug ?? profile?.canonicalSlug ?? ''} className="mt-2 w-full rounded-xl border border-line px-3 py-2 font-normal" /></label></div> })}
      </section>
      {shownDuplicates.length > 0 ? <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5"><h2 className="font-black text-amber-950">Posibles duplicados: revisión humana obligatoria</h2>{shownDuplicates.map(item => <p key={item.id} className="mt-2 text-sm"><Link className="font-semibold underline" href={`/paneladmin/fichero/${catalogKey}/fichas/${item.id}`}>{item.displayName}</Link> · {item.canonicalSlug}</p>)}<label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="duplicate_reviewed" value="yes" required />He comparado estas coincidencias y son fichas distintas.</label></section> : null}
      <button disabled={pending} className="rounded-full bg-slate-900 px-6 py-3 font-bold text-white disabled:opacity-50">{pending ? 'Guardando…' : 'Guardar borrador'}</button>
      {state.error || state.success ? <p role={state.error ? 'alert' : 'status'}>{state.error ?? state.success}</p> : null}
      {state.profileHref ? <Link href={state.profileHref} className="ml-4 font-semibold text-brand underline">Abrir ficha guardada</Link> : null}
    </form>
  )
}
