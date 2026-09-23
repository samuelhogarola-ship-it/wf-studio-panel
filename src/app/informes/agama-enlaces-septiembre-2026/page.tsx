import links from '@/lib/resources/agama-links.json'
import { PrintButton } from '@/components/ui/print-button'
export const metadata = { title: 'AGAMA · Informe de enlaces', robots: { index: false, follow: false } }
export default function Page() {
 return <main className="mx-auto max-w-5xl px-5 py-12">
 <p className="text-sm font-semibold text-brand">WF-STUDIO · AGAMA</p><h1 className="my-4 text-3xl font-bold">Informe de enlaces y contenido para EEUU</h1>
 <p className="mb-4">Entrega: 23 de septiembre de 2026. Última comprobación documentada: 18 de septiembre de 2026.</p>
 <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden"><a className="rounded-full bg-brand px-5 py-3 font-semibold text-white" href="/api/informes/agama-enlaces" download>Descargar informe completo</a><PrintButton /></div>
 <p className="my-4">83 enlaces en total: 72 recursos de producto en español e inglés, seis artículos educativos en inglés, dos páginas de servicio y tres páginas de categoría. Los 47 enlaces en inglés están incluidos en los 83.</p>
 <p className="my-4">La revisión del 18 de septiembre registró 83 respuestas HTTP 200, con canonical y sin meta noindex. Esta entrega recupera esa revisión; no acredita una nueva comprobación, posiciones ni tráfico desde EEUU. Son páginas de AGAMA, no backlinks externos.</p>
 <h2 className="mt-8 text-2xl font-bold">Contenido específico para EEUU</h2><ul className="my-4 space-y-3">{links.filter(l => l.usa).map(l => <li key={l.url}><a className="text-brand underline" href={l.url}>{l.label}</a></li>)}</ul>
 <h2 className="mt-8 text-2xl font-bold">Inventario completo · 83 enlaces</h2>
 <div className="overflow-x-auto"><table className="my-5 w-full text-left text-sm"><thead><tr><th className="p-3">Contenido</th><th className="p-3">Idioma</th><th className="p-3">Enlace</th></tr></thead><tbody>{links.map(l => <tr className="border-t border-line" key={l.url}><td className="p-3">{l.product || l.category}</td><td className="p-3">{l.english ? 'EN' : 'ES'}</td><td className="p-3"><a className="text-brand underline" href={l.url}>{l.label}</a></td></tr>)}</tbody></table></div>
 </main>
}
