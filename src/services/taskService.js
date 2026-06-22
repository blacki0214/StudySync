/**
 * taskService.js
 * ----------------------------------------------------------------------------
 * CRUD + realtime for the Notion-style task tracker. A task is either PERSONAL
 * (subjectId null) or SUBJECT-scoped. Follows the demo-mode gate: with no
 * Supabase configured everything works against localStorage (seeded from
 * sampleTasks) so the feature runs fully offline.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { sampleTasks } from '../data/sampleTasks.js'

const DEMO_KEY = 'studysync_demo_tasks'
let demoCounter = 9000
const nextId = () => `task-${++demoCounter}`

function readDemo() {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (raw == null) {
      // First run: seed from the bundled sample tasks.
      localStorage.setItem(DEMO_KEY, JSON.stringify(sampleTasks))
      return [...sampleTasks]
    }
    return JSON.parse(raw)
  } catch {
    return []
  }
}
function writeDemo(list) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(list))
}
const sortTasks = (a, b) => (a.position - b.position) || (new Date(a.created_at) - new Date(b.created_at))

export const taskService = {
  /**
   * List tasks for a scope. Pass a subjectId for that subject's board, or omit
   * it (with ownerId) for the user's personal tasks.
   */
  async list({ subjectId = null, ownerId = null } = {}) {
    if (!isSupabaseConfigured) {
      const all = readDemo()
      const scoped = subjectId
        ? all.filter((t) => t.subject_id === subjectId)
        : all.filter((t) => !t.subject_id) // single-user demo: show all personal tasks
      return scoped.sort(sortTasks)
    }
    let query = supabase.from('tasks').select('*')
    if (subjectId) query = query.eq('subject_id', subjectId)
    else query = query.is('subject_id', null).eq('owner_id', ownerId)
    const { data, error } = await query.order('position', { ascending: true }).order('created_at', { ascending: true })
    if (error) throw error
    return data
  },

  /** Create a task. Defaults match the UI's "+ New task". */
  async create({ subjectId = null, ownerId, title = 'Untitled task', status = 'not_started', priority = 'medium', type = 'general', dueDate = null, description = '', assigneeName = null, position = 0 }) {
    const base = {
      owner_id: ownerId,
      subject_id: subjectId,
      title: title.trim() || 'Untitled task',
      status, priority, type,
      due_date: dueDate,
      description,
      assignee_id: ownerId,
      assignee_name: assigneeName,
      position
    }
    if (!isSupabaseConfigured) {
      const row = { id: nextId(), ...base, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      const list = readDemo()
      list.push(row)
      writeDemo(list)
      return row
    }
    const { data, error } = await supabase.from('tasks').insert(base).select().single()
    if (error) throw error
    return data
  },

  /** Patch a task (partial fields). */
  async update(id, patch) {
    if (!isSupabaseConfigured) {
      const list = readDemo()
      const row = list.find((t) => t.id === id)
      if (row) { Object.assign(row, patch, { updated_at: new Date().toISOString() }); writeDemo(list) }
      return row
    }
    const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().single()
    if (error) throw error
    return data
  },

  /** Delete a task. */
  async remove(id) {
    if (!isSupabaseConfigured) {
      writeDemo(readDemo().filter((t) => t.id !== id))
      return
    }
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
  },

  /**
   * Subscribe to live task changes for a scope. Returns an unsubscribe fn
   * (no-op in demo mode).
   */
  subscribe({ subjectId = null, ownerId = null }, onChange) {
    if (!isSupabaseConfigured) return () => {}
    const filter = subjectId ? `subject_id=eq.${subjectId}` : `owner_id=eq.${ownerId}`
    const ch = supabase
      .channel(`tasks:${subjectId || ownerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter }, () => onChange())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }
}
