export function AnalyticsSkeleton() {
  return (
    <section
      className="my-8 overflow-hidden rounded-[28px] border border-black/10 bg-[#f3f0e8]"
      aria-label="Cargando estadísticas de audiencia"
      aria-busy="true"
    >
      <div className="animate-pulse p-6 sm:p-8">
        <div className="h-3 w-40 rounded-full bg-black/10" />
        <div className="mt-4 h-10 w-64 max-w-full rounded-xl bg-black/10" />
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-black/10 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-28 bg-white/70 p-5">
              <div className="h-3 w-20 rounded-full bg-black/10" />
              <div className="mt-4 h-7 w-24 rounded-lg bg-black/10" />
            </div>
          ))}
        </div>
        <div className="mt-6 h-64 rounded-2xl bg-white/70" />
      </div>
    </section>
  )
}
