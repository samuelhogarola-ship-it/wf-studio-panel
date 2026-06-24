import { requireClientAccess } from '@/lib/auth'
import { ClientShell } from '@/components/layout/client-shell'

export const dynamic = 'force-dynamic'

export default async function ClientPage() {
  const identity = await requireClientAccess()

  return (
    <ClientShell clientName={identity.client.name} clientEmail={identity.email}>
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Packs</h1>
        <p className="mt-1 text-slate-500">Tus packs cerrados activos.</p>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <p className="text-slate-400 text-sm">Próximamente disponible.</p>
      </div>
    </ClientShell>
  )
}
