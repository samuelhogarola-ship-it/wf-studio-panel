import Link from 'next/link'

export function ProjectIdentity({
  name,
  domain,
  status,
  backHref,
  backLabel,
  heading = 'h1',
}: {
  name: string
  domain: string
  status?: string
  backHref?: string
  backLabel?: string
  heading?: 'h1' | 'h2'
}) {
  const Heading = heading
  return <header>
    {backHref && backLabel ? <Link href={backHref} className="text-sm font-semibold text-brand underline">← {backLabel}</Link> : null}
    <Heading className="mt-1 text-2xl font-black">{name}</Heading>
    <p className="mt-1 break-all text-muted">{domain}{status ? ` · ${status}` : ''}</p>
  </header>
}
