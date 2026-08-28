const ITEMS = [
  { href: '/paneladmin/superentrenador/estadisticas', label: 'Estadísticas' },
  { href: '/paneladmin/superentrenador/pt', label: 'Entrenadores' },
  { href: '/paneladmin/superentrenador/usuarios', label: 'Usuarios' },
]

export function getSuperEntrenadorNavigation(currentPath) {
  return ITEMS.map((item) => ({ ...item, active: currentPath === item.href }))
}
