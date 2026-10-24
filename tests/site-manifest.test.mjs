import test from 'node:test';
import assert from 'node:assert/strict';

const { SITE_MANIFEST, getManifestSite, getManifestSites } = await import('../src/lib/sites/manifest.ts');
const { getSites } = await import('../src/lib/sites/registry.mjs');
const { getConfiguredUmamiSites } = await import('../src/lib/analytics/umami-core.mjs');

test('canonical site manifest has one stable identity for every registered site', () => {
  const sites = getManifestSites();
  assert.equal(sites.length, 18);
  assert.equal(new Set(sites.map(site => site.key)).size, sites.length);
  assert.equal(new Set(sites.map(site => site.domain)).size, sites.length);
  for (const site of sites) {
    assert.equal(getManifestSite(site.key), site);
    assert.equal(typeof site.name, 'string');
    assert.equal(typeof site.domain, 'string');
    assert.equal(typeof site.productionUrl, 'string');
    assert.ok(site.panelKey);
    assert.ok(site.analytics.source === 'personal' || site.analytics.source === 'agama');
  }
  assert.equal(SITE_MANIFEST.find(site => site.key === 'agama').domain, 'agama.com.mx');
  assert.equal(SITE_MANIFEST.find(site => site.key === 'todoplastico').domain, 'todo-plastico.com');
});

test('manifest preserves Blogger opt-in and legacy analytics aliases', () => {
  assert.equal(getManifestSite('sportmassagefuengirola').blogger.enabled, true);
  assert.equal(getManifestSite('webfuengirola').blogger.enabled, false);
  assert.equal(getManifestSite('vokabellab').analytics.legacyKey, 'vokabelworld');
  assert.equal(getManifestSite('todoplastico').analytics.legacyKey, 'agama');
});

test('registry and analytics adapters derive identity from the manifest', () => {
  assert.deepEqual(
    getSites().map(({ key, name, domain, productionUrl, panel }) => ({ key, name, domain, productionUrl, panel })),
    SITE_MANIFEST.map(({ key, name, domain, productionUrl, panel }) => ({ key, name, domain, productionUrl, panel })),
  );
  assert.deepEqual(
    getConfiguredUmamiSites({}).map(({ key, label, domain, source, panelKey }) => ({ key, label, domain, source, panelKey })),
    SITE_MANIFEST.map(({ key, name, domain, analytics, panelKey }) => ({ key, label: name, domain, source: analytics.source, panelKey })),
  );
});

test('unknown site identities fail closed', () => {
  assert.throws(() => getManifestSite('unknown-site'), /Sitio desconocido/);
});
