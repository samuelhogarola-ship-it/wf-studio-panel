export function getBloggerEditorTarget(site) {
  const blogger = site?.blogger;
  if (!blogger?.enabled && blogger?.enabled !== undefined) return null;
  if (blogger?.runtime === 'central-multisite' && typeof site?.key === 'string') {
    return { kind: 'iframe', href: `/blogger/editor/index.html?siteKey=${encodeURIComponent(site.key)}` };
  }
  if (blogger?.runtime === 'central-legacy') return { kind: 'iframe', href: '/blogger/' };
  if (blogger?.runtime === 'external' && typeof blogger.url === 'string') return { kind: 'external', href: blogger.url };
  return null;
}
