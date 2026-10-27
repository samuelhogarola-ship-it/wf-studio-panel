import { getSites } from '../sites/registry.mjs'

export function createCustomBloggerHostMap(sites) {
  const entries = new Map()
  for (const site of sites) {
    const origin = getCustomBloggerOrigin(site)
    if (!origin) continue
    const hostname = new URL(origin).hostname.toLowerCase()
    if (entries.has(hostname)) throw new Error(`Blogger custom host duplicado: ${hostname}`)
    entries.set(hostname, site)
  }
  return entries
}

const customSitesByHost = createCustomBloggerHostMap(getSites())

export function getCustomBloggerOrigin(site) {
  const origin = site?.blogger?.customOrigin
  return typeof origin === 'string' && origin.length > 0 ? origin : null
}

export function getCustomBloggerSiteByHost(hostname) {
  if (typeof hostname !== 'string' || hostname !== hostname.trim() || hostname.includes(':') || hostname.includes(',')) {
    return null
  }
  return customSitesByHost.get(hostname.toLowerCase()) ?? null
}
