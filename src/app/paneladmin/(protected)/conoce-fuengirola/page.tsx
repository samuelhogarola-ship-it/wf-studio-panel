import { AdminShell } from '@/components/layout/app-shell'
import { requireAdmin } from '@/lib/auth'
import { getLocale } from '@/lib/locale'

export default async function Page() {
  const identity = await requireAdmin()
  const locale = await getLocale()
  return (
    <AdminShell
      title="Conoce Fuengirola"
      description="Gestión de contenido de Conoce Fuengirola"
      currentPath="/paneladmin/conoce-fuengirola"
      userEmail={identity.email}
      locale={locale}
    >
      <div className="flex items-center justify-center rounded-xl border border-dashed border-line h-64">
        <p className="text-sm text-muted">Esta sección está en desarrollo.</p>
      </div>
    </AdminShell>
  )
}
