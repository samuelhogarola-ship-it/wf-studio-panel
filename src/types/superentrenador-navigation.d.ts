declare module '@/lib/data/superentrenador-navigation.mjs' {
  export type SuperEntrenadorNavigationItem = { href: string; label: string; active: boolean }
  export function getSuperEntrenadorNavigation(currentPath: string): SuperEntrenadorNavigationItem[]
}
