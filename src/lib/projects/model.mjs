/**
 * Check a destination without rewriting it. Production is the safe default.
 * Canonical domains are bare DNS hostnames; only their apex/www pair is allowed.
 */
export function validateProjectDestination(rawUrl, canonicalDomain, production = true) {
  if (typeof rawUrl !== 'string' || typeof canonicalDomain !== 'string') return false;
  const domain = canonicalDomain.toLowerCase().replace(/^www\./, '');
  const labels = domain.split('.');
  if (domain.length > 253 || labels.length < 2 ||
      labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
      !/[a-z]/.test(labels.at(-1)) || labels.at(-1) === 'localhost') return false;

  // WHATWG parsing repairs whitespace/backslashes; reject those instead.
  if (!/^https?:\/\/[^/?#]+(?:[/?#]|$)/i.test(rawUrl) || /[\s\\]/.test(rawUrl)) return false;
  try {
    const canonical = new URL(`https://${domain}`);
    if (canonical.hostname !== domain) return false; // Includes numeric/IP aliases.
    const url = new URL(rawUrl);
    return (url.protocol === 'https:' || (production === false && url.protocol === 'http:')) &&
      !url.username && !url.password && !url.port &&
      (url.hostname === domain || url.hostname === `www.${domain}`);
  } catch {
    return false;
  }
}

export function validateBloggerProjectDestination(rawUrl, canonicalDomain, siteKey) {
  if (validateProjectDestination(rawUrl, canonicalDomain, true)) return true;
  if (typeof rawUrl !== 'string' || typeof siteKey !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(siteKey)) return false;
  try {
    const url = new URL(rawUrl);
    return url.origin === 'https://admin.webfuengirola.com' &&
      url.pathname === `/paneladmin/blogger/${siteKey}` && !url.search && !url.hash &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}
