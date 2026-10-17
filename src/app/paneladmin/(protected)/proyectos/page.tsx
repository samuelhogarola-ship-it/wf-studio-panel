import Link from "next/link";

import { AdminShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getSites } from "@/lib/sites/registry.mjs";

export default async function Page() {
  const identity = await requireAdmin();
  const locale = await getLocale();
  const sites = getSites();
  return (
    <AdminShell
      title="Proyectos"
      description="Gestión de proyectos de WF-Studio"
      currentPath="/paneladmin/proyectos"
      userEmail={identity.email}
      locale={locale}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sites.map((site) => (
          <Card key={site.key} className="flex flex-col gap-4 p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand">
                {site.domain}
              </p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-foreground">
                {site.name}
              </h2>
              <p className="mt-2 text-sm text-muted">
                Panel: {site.panel.key} · Analítica: {site.analytics.source}
              </p>
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <a
                href={site.productionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-line px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Abrir web ↗
              </a>
              <Link
                href={site.panel.path}
                className="rounded border border-line px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Abrir panel
              </Link>
              {site.blogger.enabled ? (
                <a
                  href={site.blogger.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-brand px-3 py-2 text-sm font-bold text-white"
                >
                  Blogger ↗
                </a>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
