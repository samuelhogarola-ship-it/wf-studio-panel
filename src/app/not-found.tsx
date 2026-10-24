import Link from 'next/link'

export default function NotFound() {
  return <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 px-6" role="main">
    <p className="text-sm font-semibold uppercase tracking-widest text-brand">404</p>
    <h1 className="text-3xl font-extrabold">No encontramos esta página.</h1>
    <Link href="/" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white">Volver al inicio</Link>
  </main>
}
