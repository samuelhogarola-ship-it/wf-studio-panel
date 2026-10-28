import Image from 'next/image'

export type BloggerBrandingProps = {
  siteName: string
  logoPath?: string
  previewImagePath?: string
  compact?: boolean
}

export function BloggerBranding({ siteName, logoPath, previewImagePath, compact = false }: BloggerBrandingProps) {
  if (!logoPath && !previewImagePath) return null

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line bg-slate-50 ${compact ? 'mb-4' : 'mb-6 max-w-xl'}`}>
      {previewImagePath ? (
        <div className="relative aspect-square w-full overflow-hidden bg-white">
          <Image
            src={previewImagePath}
            alt={`${siteName} WF-Blogger preview`}
            fill
            priority={!compact}
            sizes={compact ? '(max-width: 640px) 100vw, 50vw' : '(max-width: 768px) 100vw, 576px'}
            className="object-cover"
          />
        </div>
      ) : null}
      {logoPath ? (
        <div className={`flex items-center gap-3 bg-white px-4 py-3 ${previewImagePath ? 'border-t border-line' : ''}`}>
          <Image src={logoPath} alt={`${siteName} logo`} width={56} height={56} className="h-14 w-14 rounded-full object-contain" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-brand">WF-Blogger</p>
            <p className="font-semibold text-foreground">{siteName}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
