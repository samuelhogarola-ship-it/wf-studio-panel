'use client'

import { useEffect, useRef } from 'react'

export function PanelBloggerLaunch({
  action,
  siteName,
  launchFailed = false,
}: {
  action: string
  siteName: string
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
      <h1 className="text-2xl font-black">{launchFailed ? 'Blogger access unavailable' : 'Opening Blogger'}</h1>
      <p className="text-sm text-muted">
        {launchFailed
          ? `We could not create temporary access for ${siteName}. You can try again.`
          : `Creating a secure temporary access for ${siteName}…`}
      </p>
      <form ref={form} action={action} method="post">
        <button type="submit" className="inline-flex rounded-lg bg-brand px-4 py-3 font-bold text-white">
          {launchFailed ? 'Try again' : 'Continue to Blogger'}
        </button>
      </form>
    </div>
  )
}
