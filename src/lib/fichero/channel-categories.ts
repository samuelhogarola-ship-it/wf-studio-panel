// Public category identifiers currently used by each Fuengirola directory.
export const channelCategories = {
  'vivir-fuengirola': ['abogados', 'barberos', 'belleza', 'colegios', 'dentistas', 'farmacias', 'fisioterapeutas', 'fruterias', 'gimnasios', 'guarderias', 'hoteles', 'inmobiliaria', 'moda', 'ocio', 'panaderias', 'peluquerias', 'reformas', 'restaurantes', 'servicios', 'talleres'],
  'conoce-fuengirola': ['deporte-y-entrenamiento', 'diseno-web', 'escuelas-de-idiomas', 'hoteles-y-escapadas', 'ocio-y-cultura', 'salud-y-bienestar'],
} as const

export function categoryLabel(slug: string) {
  return slug.replaceAll('-', ' ')
}
