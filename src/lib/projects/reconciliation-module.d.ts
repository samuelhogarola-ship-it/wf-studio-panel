declare module "@/lib/projects/reconciliation.mjs" {
  export type ProjectRegistryIssue = {
    kind: "missing-project" | "missing-registry-site" | "domain-mismatch";
    projectId?: string;
    siteKey?: string;
    message: string;
  };

  type ReconciliationProject = {
    id: string;
    name: string;
    domain: string;
    analytics_registry_key?: string | null;
  };

  type ReconciliationSite = {
    key: string;
    name: string;
    domain: string;
  };

  export function reconcileProjectsWithRegistry(
    projects: readonly ReconciliationProject[],
    sites: readonly ReconciliationSite[],
  ): ProjectRegistryIssue[];
}
