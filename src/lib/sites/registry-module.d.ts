declare module "@/lib/sites/registry.mjs" {
  export type RegisteredSite = {
    schemaVersion: 1;
    key: string;
    name: string;
    domain: string;
    productionUrl: string;
    allowedOrigins?: string[];
    repository?: string;
    panel: { key: string; path: string };
    analytics: {
      source: string;
      envSuffix: string;
      legacyDashboard: boolean;
      legacyKey?: string;
      legacyLabel?: string;
    };
    blogger: {
      enabled: boolean;
      variant?: 'static' | 'vps';
      runtime?: 'central-multisite' | 'central-legacy' | 'external';
      customOrigin?: string;
      logoPath?: string;
      previewImagePath?: string;
      url?: string;
      apiBase?: string;
      buildEndpoint?: string;
      contentDir?: string;
      publicPostBase?: string;
      launchUrl?: string;
      healthUrl?: string;
      adapter?: string;
      capabilities?: string[];
    };
  };

  export type BloggerHandoff = Omit<
    RegisteredSite['blogger'],
    'enabled' | 'runtime' | 'url' | 'launchUrl' | 'healthUrl' | 'adapter' | 'capabilities'
  > & {
    enabled: true;
    runtime: 'central-multisite' | 'central-legacy' | 'external';
    url: string;
    launchUrl: string;
    healthUrl: string;
    adapter: string;
    capabilities: [string, ...string[]];
  };

  export const SITE_REGISTRY: readonly RegisteredSite[];
  export function getSites(): readonly RegisteredSite[];
  export function getSiteByKey(key: string): RegisteredSite;
  export function validateSite(site: RegisteredSite): RegisteredSite;
  export function getBloggerHandoff(site: RegisteredSite): BloggerHandoff | null;
  export function getLegacyAnalyticsProjects(): ReadonlyArray<{
    key: string;
    label: string;
    domain: string;
    source: string;
    envSuffix: string;
  }>;
}
