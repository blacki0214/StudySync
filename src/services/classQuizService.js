/**
 * classQuizService.js
 * ----------------------------------------------------------------------------
 * Teacher-authored quizzes scoped to a class (Phase 4). A quiz stores its
 * multiple-choice questions as jsonb; students take it and their score is saved
 * to quiz_results (feeding the gradebook).
 *
 * Demo mode persists to localStorage; live mode uses Supabase
 * (supabase/migration_class_quizzes.sql).
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const K_QUIZZES = 'studysync_demo_class_quizzes'
const K_RESULTS = 'studysync_demo_quiz_results'
let counter = 12000
const nextId = (p) => `${p}-${++counter}`

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v))

export const classQuizService = {
  async listQuizzes(classId) {
    if (!isSupabaseConfigured) {
      return read(K_QUIZZES).filter((q) => q.class_id === classId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
    const { data, error } = await supabase
      .from('class_quizzes').select('*').eq('class_id', classId).order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async createQuiz({ classId, title, questions, ownerId }) {
    if (!isSupabaseConfigured) {
      const row = { id: nextId('quiz'), class_id: classId, owner_id: ownerId, title: title.trim(), questions, created_at: new Date().toISOString() }
      const list = read(K_QUIZZES); list.unshift(row); write(K_QUIZZES, list)
      return row
    }
    const { data, error } = await supabase
      .from('class_quizzes').insert({ class_id: classId, owner_id: ownerId, title: title.trim(), questions }).select().single()
    if (error) throw error
    return data
  },

  async deleteQuiz(id) {
    if (!isSupabaseConfigured) {
      write(K_QUIZZES, read(K_QUIZZES).filter((q) => q.id !== id))
      write(K_RESULTS, read(K_RESULTS).filter((r) => r.quiz_id !== id))
      return
    }
    const { error } = await supabase.from('class_quizzes').delete().eq('id', id)
    if (error) throw error
  },

  async saveResult({ quizId, userId, userName, score, total }) {
    if (!isSupabaseConfigured) {
      const list = read(K_RESULTS).filter((r) => !(r.quiz_id === quizId && r.user_id === userId))
      const row = { id: nextId('res'), quiz_id: quizId, user_id: userId, full_name: userName, score, total, taken_at: new Date().toISOString() }
      list.unshift(row); write(K_RESULTS, list)
      return row
    }
    const { data, error } = await supabase
      .from('quiz_results')
      .upsert({ quiz_id: quizId, user_id: userId, score, total }, { onConflict: 'quiz_id,user_id' })
      .select().single()
    if (error) throw error
    return data
  },

  async listResults(quizId) {
    if (!isSupabaseConfigured) {
      return read(K_RESULTS).filter((r) => r.quiz_id === quizId)
        .map((r) => ({ ...r, profile: { full_name: r.full_name } }))
    }
    const { data, error } = await supabase
      .from('quiz_results').select('*, profile:profiles(*)').eq('quiz_id', quizId)
    if (error) throw error
    return data
  },

  async myResult(quizId, userId) {
    if (!isSupabaseConfigured) {
      return read(K_RESULTS).find((r) => r.quiz_id === quizId && r.user_id === userId) || null
    }
    const { data, error } = await supabase
      .from('quiz_results').select('*').eq('quiz_id', quizId).eq('user_id', userId).maybeSingle()
    if (error) throw error
    return data
  }
}
