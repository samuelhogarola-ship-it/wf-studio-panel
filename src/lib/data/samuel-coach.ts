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

type Question = { id: string; enunciado: string; respuesta: boolean; explicacion: string | null; order_index: number }
type TextWithQuestions = { id: string; nivel: string; titulo: string; is_published: boolean; questions: Question[] }

export const getSamuelCoachEjerciciosData = cache(async () => {
  const db = createImKontextAdminClient()

  const [{ data: texts }, { data: questions }] = await Promise.all([
    db
      .from('samuel_texts')
      .select('id, nivel, titulo, is_published')
      .eq('app_key', 'samuel_coach')
      .order('nivel')
      .order('titulo'),
    db
      .from('samuel_questions')
      .select('id, text_id, enunciado, respuesta, explicacion, order_index')
      .order('order_index'),
  ])

  const questionsByText = new Map<string, Question[]>()
  for (const q of questions ?? []) {
    const list = questionsByText.get(q.text_id) ?? []
    list.push({ id: q.id, enunciado: q.enunciado, respuesta: q.respuesta, explicacion: q.explicacion, order_index: q.order_index })
    questionsByText.set(q.text_id, list)
  }

  const byNivel = new Map<string, TextWithQuestions[]>()
  for (const t of texts ?? []) {
    const list = byNivel.get(t.nivel) ?? []
    list.push({ id: t.id, nivel: t.nivel, titulo: t.titulo, is_published: t.is_published, questions: questionsByText.get(t.id) ?? [] })
    byNivel.set(t.nivel, list)
  }

  return { byNivel, total: texts?.length ?? 0, totalQuestions: questions?.length ?? 0 }
})
