declare module '@/lib/data/superentrenador-navigation.mjs' {
  export type SuperEntrenadorNavigationItem = { href: string; label: string; active: boolean }
  export function getSuperEntrenadorNavigation(currentPath: string): SuperEntrenadorNavigationItem[]
  export function isNavigationItemActive(currentPath: string, href: string, activePrefix?: string): boolean
}
