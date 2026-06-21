/**
 * assignmentService.js
 * ----------------------------------------------------------------------------
 * Class assignments + student submissions + the quiz gradebook. Assignments are
 * either free-text or auto-graded quizzes generated from a class document. Live
 * mode uses Supabase (RLS scopes teacher vs student); demo mode keeps everything
 * in localStorage. Quiz attempts are also recorded for analytics.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const K_ASSIGN = 'studysync_demo_assignments'
const K_SUBS = 'studysync_demo_submissions'
const K_ATTEMPTS = 'studysync_demo_attempts'
let counter = 9000
const nextId = (p) => `${p}-${++counter}`
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v))

export const assignmentService = {
  /** Assignments in a class, newest first. */
  async listByClass(classId) {
    if (!isSupabaseConfigured) {
      return read(K_ASSIGN).filter((a) => a.class_id === classId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
    const { data, error } = await supabase
      .from('assignments').select('*').eq('class_id', classId).order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async create({ classId, authorId, title, instructions = '', type = 'text', sourceDocumentId = null, dueAt = null }) {
    const base = { class_id: classId, author_id: authorId, title: title.trim(), instructions, type, source_document_id: sourceDocumentId, due_at: dueAt }
    if (!isSupabaseConfigured) {
      const row = { id: nextId('asg'), created_at: new Date().toISOString(), ...base }
      const list = read(K_ASSIGN); list.unshift(row); write(K_ASSIGN, list)
      return row
    }
    const { data, error } = await supabase.from('assignments').insert(base).select().single()
    if (error) throw error
    return data
  },

  async remove(id) {
    if (!isSupabaseConfigured) {
      write(K_ASSIGN, read(K_ASSIGN).filter((a) => a.id !== id))
      write(K_SUBS, read(K_SUBS).filter((s) => s.assignment_id !== id))
      return
    }
    const { error } = await supabase.from('assignments').delete().eq('id', id)
    if (error) throw error
  },

  /** A student's own submission for an assignment (or null). */
  async getMySubmission(assignmentId, userId) {
    if (!isSupabaseConfigured) {
      return read(K_SUBS).find((s) => s.assignment_id === assignmentId && s.user_id === userId) || null
    }
    const { data, error } = await supabase
      .from('submissions').select('*').eq('assignment_id', assignmentId).eq('user_id', userId).maybeSingle()
    if (error) throw error
    return data
  },

  /** All submissions for an assignment (teacher view). */
  async listSubmissions(assignmentId) {
    if (!isSupabaseConfigured) {
      return read(K_SUBS).filter((s) => s.assignment_id === assignmentId)
        .map((s) => ({ ...s, user: { full_name: s.user_name || 'Student' } }))
    }
    const { data, error } = await supabase
      .from('submissions').select('*, user:profiles(*)').eq('assignment_id', assignmentId).order('created_at')
    if (error) throw error
    return data
  },

  /** All submissions across a class's assignments (gradebook). */
  async classSubmissions(classId) {
    if (!isSupabaseConfigured) {
      const ids = new Set(read(K_ASSIGN).filter((a) => a.class_id === classId).map((a) => a.id))
      return read(K_SUBS).filter((s) => ids.has(s.assignment_id))
        .map((s) => ({ ...s, user: { full_name: s.user_name || 'Student' } }))
    }
    const { data, error } = await supabase
      .from('submissions')
      .select('*, assignment:assignments!inner(id,title,class_id), user:profiles(*)')
      .eq('assignment.class_id', classId)
    if (error) throw error
    return data
  },

  /** Create/update a student's submission (auto-graded for quizzes). */
  async submit({ assignmentId, userId, userName, content = '', answers = [], score = null, total = null, graded = false }) {
    if (!isSupabaseConfigured) {
      const list = read(K_SUBS)
      const idx = list.findIndex((s) => s.assignment_id === assignmentId && s.user_id === userId)
      const row = {
        id: idx >= 0 ? list[idx].id : nextId('sub'),
        assignment_id: assignmentId, user_id: userId, user_name: userName,
        content, answers, score, total, graded,
        created_at: idx >= 0 ? list[idx].created_at : new Date().toISOString()
      }
      if (idx >= 0) list[idx] = row; else list.unshift(row)
      write(K_SUBS, list)
      return row
    }
    const { data, error } = await supabase
      .from('submissions')
      .upsert({ assignment_id: assignmentId, user_id: userId, content, answers, score, total, graded }, { onConflict: 'assignment_id,user_id' })
      .select().single()
    if (error) throw error
    return data
  },

  /** Teacher grades a free-text submission. */
  async grade(submissionId, score, total = 100) {
    if (!isSupabaseConfigured) {
      const list = read(K_SUBS); const s = list.find((x) => x.id === submissionId)
      if (s) { s.score = score; s.total = total; s.graded = true }
      write(K_SUBS, list); return
    }
    const { error } = await supabase.from('submissions').update({ score, total, graded: true }).eq('id', submissionId)
    if (error) throw error
  },

  /** Record a quiz attempt (analytics / self-study). */
  async recordQuizAttempt({ userId, subjectId = null, documentId = null, classId = null, score, total }) {
    if (!isSupabaseConfigured) {
      const list = read(K_ATTEMPTS)
      list.unshift({ id: nextId('att'), user_id: userId, subject_id: subjectId, document_id: documentId, class_id: classId, score, total, created_at: new Date().toISOString() })
      write(K_ATTEMPTS, list); return
    }
    const { error } = await supabase.from('quiz_attempts')
      .insert({ user_id: userId, subject_id: subjectId, document_id: documentId, class_id: classId, score, total })
    if (error) throw error
  }
}
