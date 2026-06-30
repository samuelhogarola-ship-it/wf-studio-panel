import { cache } from 'react'

import { createImKontextAdminClient } from '@/lib/supabase/server'

export const getSamuelCoachData = cache(async () => {
  const db = createImKontextAdminClient()

  const [{ data: texts }, { data: exercises }, { data: questions }] = await Promise.all([
    db
      .from('samuel_texts')
      .select('id, slug, nivel, titulo, descripcion, is_published, content_lang')
      .eq('app_key', 'samuel_coach')
      .order('nivel')
      .order('titulo'),
    db
      .from('samuel_exercises')
      .select('id, text_id, exercise_type, gap_count'),
    db
      .from('samuel_questions')
      .select('text_id'),
  ])

  const exerciseMap = new Map<string, { exercise_type: string; gap_count: number }>()
  for (const ex of exercises ?? []) {
    exerciseMap.set(ex.text_id, { exercise_type: ex.exercise_type, gap_count: ex.gap_count ?? 0 })
  }

  const questionCountMap = new Map<string, number>()
  for (const q of questions ?? []) {
    questionCountMap.set(q.text_id, (questionCountMap.get(q.text_id) ?? 0) + 1)
  }

  const rows = (texts ?? []).map((t) => ({
    ...t,
    exercise: exerciseMap.get(t.id) ?? null,
    questionCount: questionCountMap.get(t.id) ?? 0,
  }))

  const published = rows.filter((r) => r.is_published)
  const byNivel: Record<string, number> = {}
  const byType: Record<string, number> = {}

  for (const r of published) {
    byNivel[r.nivel] = (byNivel[r.nivel] ?? 0) + 1
    const type = r.exercise?.exercise_type ?? 'unknown'
    byType[type] = (byType[type] ?? 0) + 1
  }

  return { rows, published: published.length, total: rows.length, byNivel, byType }
})
