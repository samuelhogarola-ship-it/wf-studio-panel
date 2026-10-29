export function BillinPageHeader() {
  return (
    <section
      data-billin-header="true"
      className="shrink-0 border-b border-indigo-100 bg-gradient-to-r from-blue-50 via-violet-50 to-teal-50 px-6 py-4"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 via-violet-600 to-teal-500 text-white shadow-sm">
          <svg aria-hidden="true" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 3.5h7.5L18 7v13.5l-3-1.7-3 1.7-3-1.7-3 1.7v-16a1 1 0 0 1 1-1Z" />
            <path d="M14 3.5V7h4" />
            <path d="M9 10h5.5M9 13.5h6M9 17h3" />
          </svg>
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">Bill-in</h1>
          <p className="mt-0.5 text-sm text-slate-600">Facturación y contabilidad del estudio en un solo lugar.</p>
        </div>
      </div>
    </section>
  )
}
