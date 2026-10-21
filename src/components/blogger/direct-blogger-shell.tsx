import Link from 'next/link'

type BloggerSite = {
  key: string
  name: string
  domain: string
}

type BloggerEditorTarget = {
  kind: 'iframe' | 'external'
  href: string
}

export function DirectBloggerShell({
  site,
  homeHref,
  target,
}: {
  site: BloggerSite
  homeHref: string
  target: BloggerEditorTarget
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-line bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">WF-STUDIO · Blogger</p>
            <h1 className="truncate text-lg font-black text-foreground">{site.name}</h1>
            <p className="truncate text-xs text-muted">{site.domain}</p>
          </div>
          <Link href={homeHref} className="shrink-0 rounded-lg border border-line px-4 py-2 text-sm font-bold text-foreground transition hover:bg-slate-50">
            Inicio
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-screen-2xl p-4 sm:p-6">
        {target.kind === 'iframe'
          ? <iframe title={`Blogger · ${site.name}`} src={target.href} className="h-[calc(100vh-8.5rem)] min-h-[760px] w-full rounded-xl border border-line bg-white" />
          : <a href={target.href} rel="noopener noreferrer" className="inline-flex rounded-lg bg-brand px-4 py-3 font-bold text-white">Abrir Blogger · {site.name} ↗</a>}
      </main>
    </div>
  )
}
