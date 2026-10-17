export function canAccessBloggerSite(identity, siteKey, memberships = []) {
  if (!identity?.userId || !siteKey) return false;
  if (identity.role === "admin") return true;
  return identity.role === "client" && memberships.some((item) => item.userId === identity.userId && item.siteKey === siteKey);
}

export function assertBloggerSiteAccess(identity, siteKey, memberships = []) {
  if (canAccessBloggerSite(identity, siteKey, memberships)) return;
  throw Object.assign(new Error("No tienes acceso a esta web."), { status: 403 });
}
