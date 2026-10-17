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
      url?: string;
      apiBase?: string;
      buildEndpoint?: string;
      publicPostBase?: string;
      launchUrl?: string;
      healthUrl?: string;
      adapter?: string;
      capabilities?: string[];
    };
  };

  export const SITE_REGISTRY: readonly RegisteredSite[];
  export function getSites(): readonly RegisteredSite[];
  export function getSiteByKey(key: string): RegisteredSite;
  export function validateSite(site: RegisteredSite): RegisteredSite;
  export function getBloggerHandoff(site: RegisteredSite): RegisteredSite['blogger'] | null;
  export function getLegacyAnalyticsProjects(): ReadonlyArray<{
    key: string;
    label: string;
    domain: string;
    source: string;
    envSuffix: string;
  }>;
}
