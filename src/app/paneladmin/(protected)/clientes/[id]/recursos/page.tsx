import { getLocale } from '@/lib/locale'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { listResources } from '@/lib/resources/data'
import { ResourceList } from '@/components/client/resource-list'
import { ResourceForm } from '@/components/client/resource-form'
import { AdminShell } from '@/components/layout/app-shell'
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
 const identity = await requireAdmin()
 const locale = await getLocale()
 const { id } = await params
 const { data: client } = await getSupabaseAdminClient().from('clients').select('id,name').eq('id', id).eq('project','wf-studio').maybeSingle()
 if (!client) notFound()
 const items = await listResources(id)
 return <AdminShell title={`Informes y recursos · ${client.name}`} description="Documentos, actualizaciones y fotografías visibles en la cuenta del cliente." currentPath="/paneladmin/informes" userEmail={identity.email} locale={locale}><div className="grid gap-6 lg:grid-cols-2"><ResourceForm admin clientId={id} /><ResourceList items={items} /></div></AdminShell>
}
