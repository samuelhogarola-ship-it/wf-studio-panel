import Link from 'next/link'

type BloggerSite = {
  key: string
  name: string
  domain: string
  productionUrl: string
}

type BloggerEditorTarget = {
  kind: 'iframe' | 'external'
  href: string
}

export function DirectBloggerShell({
  site,
  homeHref,
  target,
  directSession = false,
}: {
  site: BloggerSite
  homeHref: string
  target: BloggerEditorTarget
  directSession?: boolean
}) {
  const english = site.key === 'sportmassagefuengirola'
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-line bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">WF-STUDIO · WF-Blogger</p>
            <h1 className="truncate text-lg font-black text-foreground">{site.name}</h1>
            <p className="truncate text-xs text-muted">{site.domain}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={homeHref} className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-foreground transition hover:bg-slate-50">
              {english ? 'Home' : 'Inicio'}
            </Link>
            {directSession ? <form action="/api/blogger/direct-session" method="post">
              <input type="hidden" name="action" value="logout" />
              <button type="submit" className="rounded-lg border border-line px-4 py-2 text-sm font-bold text-foreground transition hover:bg-slate-50">Sign out</button>
            </form> : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-screen-2xl p-4 sm:p-6">
        {target.kind === 'iframe'
          ? <iframe title={`WF-Blogger · ${site.name}`} src={target.href} className="h-[calc(100vh-8.5rem)] min-h-[760px] w-full rounded-xl border border-line bg-white" />
          : <a href={target.href} rel="noopener noreferrer" className="inline-flex rounded-lg bg-brand px-4 py-3 font-bold text-white">{english ? 'Open WF-Blogger' : 'Abrir WF-Blogger'} · {site.name} ↗</a>}
      </main>
    </div>
  )
}
