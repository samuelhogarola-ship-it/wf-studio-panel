'use client'

import { useEffect, useRef } from 'react'
import { BloggerBranding } from '@/components/blogger/blogger-branding'

export function PanelBloggerLaunch({
  action,
  siteName,
  logoPath,
  previewImagePath,
  launchFailed = false,
}: {
  action: string
  siteName: string
  logoPath?: string
  previewImagePath?: string
  launchFailed?: boolean
}) {
  const form = useRef<HTMLFormElement>(null)
  const submitted = useRef(false)

  useEffect(() => {
    if (launchFailed || submitted.current) return
    submitted.current = true
    form.current?.submit()
  }, [launchFailed])

  return (
    <div className="space-y-4 rounded-xl border border-line bg-white p-6">
      <BloggerBranding siteName={siteName} logoPath={logoPath} previewImagePath={previewImagePath} />
      <h1 className="text-2xl font-black">{launchFailed ? 'WF-Blogger access unavailable' : 'Opening WF-Blogger'}</h1>
      <p className="text-sm text-muted">
        {launchFailed
          ? `We could not create temporary access for ${siteName}. You can try again.`
          : `Creating a secure temporary access for ${siteName}…`}
      </p>
      <form ref={form} action={action} method="post">
        <button type="submit" className="inline-flex rounded-lg bg-brand px-4 py-3 font-bold text-white">
          {launchFailed ? 'Try again' : 'Continue to WF-Blogger'}
        </button>
      </form>
    </div>
  )
}
