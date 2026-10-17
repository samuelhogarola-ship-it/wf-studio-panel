declare module '@/lib/projects/portal-navigation.mjs' {
  import type { Database, CapabilityKey, PortalMode } from '@/lib/supabase/types';

  /** RLS-filtered project rows enriched with capability rows by the caller. */
  export type PortalProject = Readonly<Pick<
    Database['public']['Tables']['client_projects']['Row'],
    'id' | 'slug' | 'name' | 'domain' | 'status' | 'client_access_enabled'
  >> & {
    readonly capabilities?: ReadonlyArray<Readonly<Pick<
      Database['public']['Tables']['project_capabilities']['Row'],
      'capability_key' | 'state'
    > & Partial<Pick<
      Database['public']['Tables']['project_capabilities']['Row'],
      'launch_url' | 'validated_at'
    >>>>;
  };

  export type PortalNavigationItem = Readonly<{
    id: string;
    href: string;
    label: string;
    projectId?: string;
    projectSlug?: string;
    capability?: CapabilityKey;
  }>;

  export function buildPortalNavigation(input: {
    mode: PortalMode;
    projects?: readonly PortalProject[];
    locale?: 'es' | 'en';
  }): readonly PortalNavigationItem[];
}
