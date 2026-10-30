import Link from 'next/link'

export function FicheroNav({ catalogKey, currentPath }: { catalogKey: string; currentPath: string }) {
  const base = `/paneladmin/fichero/${catalogKey}`
  const links = [
    ['Resumen', base], ['Solicitudes', `${base}/solicitudes`], ['Fichas', `${base}/fichas`], ['Publicaciones', `${base}/publicaciones`],
  ]
  return (
    <nav aria-label="Secciones de Fichero" className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm">
      {links.map(([label, href]) => <Link key={href} href={href} aria-current={currentPath === href ? 'page' : undefined} className={`rounded-xl px-4 py-2 text-sm font-semibold ${currentPath === href ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</Link>)}
    </nav>
  )
}
