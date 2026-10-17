'use client'

import { useEffect, useState } from 'react'

type Post = { slug: string; meta?: Record<string, string>; body?: string; title?: string; description?: string; isPublished?: boolean }

export function BloggerEditor() {
  const [posts, setPosts] = useState<Post[]>([])
  const [post, setPost] = useState<Post>({ meta: { lang: 'es', date: new Date().toISOString().slice(0, 10), author: 'Sport Massage Fuengirola', content_format: 'html' }, body: '' })
  const [status, setStatus] = useState('Cargando…')

  async function load() {
    const response = await fetch('/api/posts', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'No se pudieron cargar los posts')
    setPosts(data.posts || [])
    setStatus('Listo')
  }

  useEffect(() => { load().catch((error) => setStatus(error.message)) }, [])

  async function openPost(slug: string) {
    const response = await fetch(`/api/posts/${encodeURIComponent(slug)}`, { cache: 'no-store' })
    const data = await response.json()
    if (response.ok) setPost(data)
  }

  async function save(publish: boolean) {
    setStatus(publish ? 'Publicando…' : 'Guardando…')
    const meta = post.meta || {}
    const payload = { ...meta, title: meta.title || post.title || '', description: meta.description || post.description || '', body: post.body || '', status: publish ? 'published' : 'draft', content_format: 'html' }
    const endpoint = post.slug ? `/api/posts/${encodeURIComponent(post.slug)}` : '/api/posts'
    const response = await fetch(endpoint, { method: post.slug ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const saved = await response.json()
    if (!response.ok) throw new Error(saved.error || 'No se pudo guardar')
    setPost(saved)
    if (publish) {
      const build = await fetch('/api/build', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: saved.slug }) })
      const result = await build.json()
      if (!build.ok) throw new Error(result.error || 'No se pudo publicar')
      setStatus(`Publicado en ${result.url}`)
    } else setStatus('Borrador guardado')
    await load()
  }

  const meta = post.meta || {}
  const setMeta = (key: string, value: string) => setPost((current) => ({ ...current, meta: { ...(current.meta || {}), [key]: value } }))

  return <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
    <aside className="rounded-xl border border-line bg-white p-4">
      <button className="mb-4 w-full rounded-lg bg-brand px-3 py-2 text-sm font-bold text-white" onClick={() => setPost({ meta: { lang: 'es', date: new Date().toISOString().slice(0, 10), author: 'Sport Massage Fuengirola', content_format: 'html' }, body: '' })}>Nuevo post</button>
      <div className="space-y-2">{posts.map((item) => <button key={item.slug} className="block w-full rounded-lg border border-line p-3 text-left hover:bg-slate-50" onClick={() => openPost(item.slug)}><strong>{item.title || item.slug}</strong><span className="block text-xs text-muted">{item.slug}</span></button>)}</div>
    </aside>
    <section className="rounded-xl border border-line bg-white p-6">
      <div className="mb-5"><p className="text-xs font-bold uppercase tracking-widest text-brand">Blogger · Sport Massage</p><h1 className="mt-1 text-2xl font-black">Crear publicación HTML</h1><p className="mt-1 text-sm text-muted">Se guarda en GitHub y se publica como HTML estático en sportmassagefuengirola.com/blog/.</p></div>
      <div className="grid gap-4">
        <input className="rounded border border-line p-3" placeholder="Título" value={meta.title || ''} onChange={(event) => setMeta('title', event.target.value)} />
        <input className="rounded border border-line p-3" placeholder="Descripción SEO" value={meta.description || ''} onChange={(event) => setMeta('description', event.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2"><input className="rounded border border-line p-3" placeholder="Slug" value={post.slug || meta.slug || ''} onChange={(event) => setPost((current) => ({ ...current, slug: event.target.value, meta: { ...(current.meta || {}), slug: event.target.value } }))} /><input className="rounded border border-line p-3" type="date" value={meta.date || ''} onChange={(event) => setMeta('date', event.target.value)} /></div>
        <textarea className="min-h-[320px] rounded border border-line p-3 font-mono text-sm" placeholder="HTML del artículo" value={post.body || ''} onChange={(event) => setPost((current) => ({ ...current, body: event.target.value }))} />
        <div className="flex flex-wrap gap-3"><button className="rounded border border-line px-4 py-2 font-semibold" onClick={() => save(false).catch((error) => setStatus(error.message))}>Guardar borrador</button><button className="rounded bg-brand px-4 py-2 font-bold text-white" onClick={() => save(true).catch((error) => setStatus(error.message))}>Publicar en /blog/</button><span className="self-center text-sm text-muted">{status}</span></div>
      </div>
    </section>
  </div>
}
