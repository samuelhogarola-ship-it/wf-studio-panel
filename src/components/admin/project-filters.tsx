import { projectTranslations, type Locale } from '@/lib/i18n'
import type { ProjectClient } from '@/lib/data/projects'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

export function ProjectFilters({ clients, filters, locale }: { clients: ProjectClient[]; filters: { q?: string; client?: string; status?: string; capability?: string }; locale: Locale }) {
  const copy = projectTranslations[locale]
  return <form method="get" className="grid items-end gap-3 rounded-2xl border border-line p-4 md:grid-cols-5">
    <div><Label htmlFor="project-search">{copy.search}</Label><Input id="project-search" name="q" defaultValue={filters.q} /></div>
    <div><Label htmlFor="filter-client">{copy.client}</Label><Select id="filter-client" name="client" defaultValue={filters.client ?? ''}>
      <option value="">{copy.all}</option><option value="unassigned">{copy.unassigned}</option>
      {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
    </Select></div>
    <div><Label htmlFor="filter-status">{copy.status}</Label><Select id="filter-status" name="status" defaultValue={filters.status ?? ''}>
      <option value="">{copy.all}</option>{(['draft', 'active', 'archived'] as const).map(status => <option key={status} value={status}>{copy.statusLabels[status]}</option>)}
    </Select></div>
    <div><Label htmlFor="filter-capability">{copy.capability}</Label><Select id="filter-capability" name="capability" defaultValue={filters.capability ?? ''}>
      <option value="">{copy.all}</option>{Object.entries(copy.capabilities).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </Select></div>
    <Button type="submit">{copy.filter}</Button>
  </form>
}
