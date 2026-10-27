'use client'

import { useState } from 'react'

export function DirectBloggerLogin({ invalid = false }: { invalid?: boolean }) {
  const [showPassword, setShowPassword] = useState(false)
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">WF-STUDIO · Blogger</p>
        <h1 className="mt-2 text-2xl font-black text-foreground">Access Blogger</h1>
        <p className="mt-2 text-sm text-muted">Sport Massage Fuengirola</p>
        {invalid ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Incorrect email or password.</p> : null}
        <form action="/api/blogger/direct-session" method="post" className="mt-6 space-y-4">
          <input type="hidden" name="action" value="login" />
          <label className="block text-sm font-bold text-foreground">
            Email
            <input name="username" type="email" required autoComplete="username" defaultValue="sportmassagefuengirola@gmail.com" className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal" />
          </label>
          <label className="block text-sm font-bold text-foreground">
            Password
            <span className="mt-1 flex overflow-hidden rounded-lg border border-line focus-within:ring-2 focus-within:ring-brand/30">
              <input name="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" className="min-w-0 flex-1 px-3 py-2 font-normal outline-none" />
              <button type="button" onClick={() => setShowPassword(value => !value)} aria-pressed={showPassword} className="border-l border-line px-3 text-sm font-bold text-brand">{showPassword ? 'Hide' : 'Show'}</button>
            </span>
          </label>
          <button type="submit" className="w-full rounded-lg bg-brand px-4 py-3 font-bold text-white">Sign in</button>
        </form>
      </section>
    </main>
  )
}
