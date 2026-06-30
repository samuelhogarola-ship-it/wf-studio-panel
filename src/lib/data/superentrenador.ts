import { cache } from 'react'

import { createSuperEntrenadorAdminClient } from '@/lib/supabase/server'

export type TrainerRow = {
  id: string
  slug: string
  display_name: string
  headline: string | null
  city_slug: string | null
  review_status: string | null
  is_published: boolean
  price_from: number | null
  rating: number | null
  reviews_count: number | null
  created_at: string
  photo_url: string | null
  modalities: string[] | null
  specialties: string[] | null
}

export const getSuperEntrenadorPTData = cache(async (q = '') => {
  const db = createSuperEntrenadorAdminClient()

  let query = db
    .from('trainer_profiles')
    .select('id, slug, display_name, headline, city_slug, review_status, is_published, price_from, rating, reviews_count, created_at, photo_url, modalities, specialties')
    .order('created_at', { ascending: false })

  if (q) query = query.ilike('display_name', `%${q}%`)

  const { data: trainers } = await query

  const rows = (trainers ?? []) as TrainerRow[]
  const pending = rows.filter((t) => t.review_status === 'pending').length
  const published = rows.filter((t) => t.is_published).length
  const rejected = rows.filter((t) => t.review_status === 'rejected').length

  return { trainers: rows, stats: { total: rows.length, pending, published, rejected } }
})

export type SupabaseAuthUser = {
  id: string
  email: string | undefined
  created_at: string
  last_sign_in_at: string | undefined
  confirmed_at: string | undefined
  user_metadata: Record<string, unknown>
}

export const getSuperEntrenadorUsuariosData = cache(async (q = '') => {
  const db = createSuperEntrenadorAdminClient()

  const { data, error } = await db.auth.admin.listUsers({ perPage: 500 })
  if (error) throw error

  let users = data.users as SupabaseAuthUser[]

  if (q) {
    const lower = q.toLowerCase()
    users = users.filter((u) =>
      u.email?.toLowerCase().includes(lower) ||
      (u.user_metadata?.full_name as string | undefined)?.toLowerCase().includes(lower)
    )
  }

  users = users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const confirmed = users.filter((u) => u.confirmed_at).length
  const unconfirmed = users.length - confirmed

  return { users, stats: { total: users.length, confirmed, unconfirmed } }
})
