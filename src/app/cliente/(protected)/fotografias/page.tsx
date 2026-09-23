import { requireClientAccess } from '@/lib/auth'
import { listResources } from '@/lib/resources/data'
import { ResourceList } from '@/components/client/resource-list'
import { ResourceForm } from '@/components/client/resource-form'
export default async function Page() {
 const identity = await requireClientAccess()
 const items = await listResources(identity.client.id)
 return <div className="mx-auto max-w-4xl space-y-6"><h1 className="text-2xl font-bold">Fotografías</h1><ResourceList items={items.filter(i => i.kind === 'photo')} /><ResourceForm /></div>
}
