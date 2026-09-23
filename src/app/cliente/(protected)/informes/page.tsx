import { requireClientAccess } from '@/lib/auth'
import { listResources } from '@/lib/resources/data'
import { ResourceList } from '@/components/client/resource-list'

export default async function Page() {
 const identity = await requireClientAccess()
 const items = await listResources(identity.client.id)
 return <div className="mx-auto max-w-4xl space-y-6"><h1 className="text-2xl font-bold">Informes</h1><ResourceList items={items.filter(i => i.kind === 'report')} /></div>
}
