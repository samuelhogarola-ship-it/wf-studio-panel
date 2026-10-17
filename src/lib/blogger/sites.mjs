import path from 'node:path';
import { getSiteByKey } from '../sites/registry.mjs';

export function getBloggerSite(siteKey) {
  const site = getSiteByKey(siteKey);
  if (!site.blogger?.enabled) throw Object.assign(new Error('Blogger no está habilitado para esta web.'), { status: 404 });
  const roots = JSON.parse(process.env.BLOGGER_SITE_ROOTS_JSON || '{}');
  const root = roots[siteKey] || path.join(process.env.BLOGGER_SITES_ROOT || '/data/blogger', siteKey);
  return { site, root: path.resolve(root) };
}
