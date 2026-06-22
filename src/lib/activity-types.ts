export const ACTIVITY_TYPES = [
  'web',
  'seo',
  'hosting',
  'marketing',
  'soporte',
  'desarrollo',
  'reunion',
  'otro',
] as const

export type ActivityType = (typeof ACTIVITY_TYPES)[number]
