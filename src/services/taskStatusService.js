/**
 * taskStatusService.js
 * ----------------------------------------------------------------------------
 * Persists each board's custom status set and the user's saved status templates.
 * Follows the demo-mode gate: localStorage when Supabase isn't configured, the
 * `task_status_sets` / `task_status_templates` tables otherwise. Built-in
 * templates live in code (taskStatusTemplates.js), not here.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { DEFAULT_STATUSES, clone } from '../utils/taskStatusTemplates.js'

const SETS_KEY = 'studysync_demo_task_status_sets'
const TPL_KEY = 'studysync_demo_task_status_templates'

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }

/** Stable local key for a board (personal vs. a subject). */
const boardKey = (subjectId, ownerId) => (subjectId ? `subject:${subjectId}` : `owner:${ownerId}`)

export const taskStatusService = {
  /**
   * The active status set for a board, or the default when none is saved yet.
   * @returns {Promise<{ statuses: Array, templateKey: string|null }>}
   */
  async getStatusSet({ subjectId = null, ownerId = null } = {}) {
    if (!isSupabaseConfigured) {
      const row = read(SETS_KEY).find((r) => r.key === boardKey(subjectId, ownerId))
      return row ? { statuses: clone(row.statuses), templateKey: row.template_key || null } : { statuses: DEFAULT_STATUSES(), templateKey: 'basic' }
    }
    let query = supabase.from('task_status_sets').select('statuses, template_key')
    query = subjectId ? query.eq('subject_id', subjectId) : query.is('subject_id', null).eq('owner_id', ownerId)
    const { data } = await query.maybeSingle()
    return data ? { statuses: clone(data.statuses), templateKey: data.template_key || null } : { statuses: DEFAULT_STATUSES(), templateKey: 'basic' }
  },

  /** Create or replace a board's status set (upsert by board). */
  async saveStatusSet({ subjectId = null, ownerId = null, statuses, templateKey = null }) {
    if (!isSupabaseConfigured) {
      const rows = read(SETS_KEY)
      const key = boardKey(subjectId, ownerId)
      const existing = rows.find((r) => r.key === key)
      if (existing) { existing.statuses = statuses; existing.template_key = templateKey }
      else rows.push({ key, subject_id: subjectId, owner_id: ownerId, statuses, template_key: templateKey })
      write(SETS_KEY, rows)
      return { statuses: clone(statuses), templateKey }
    }
    // Find an existing row for this board, then update or insert (partial unique
    // indexes make a plain upsert awkward, so do it explicitly).
    let sel = supabase.from('task_status_sets').select('id')
    sel = subjectId ? sel.eq('subject_id', subjectId) : sel.is('subject_id', null).eq('owner_id', ownerId)
    const { data: found } = await sel.maybeSingle()
    const payload = { owner_id: ownerId, subject_id: subjectId, statuses, template_key: templateKey, updated_at: new Date().toISOString() }
    if (found?.id) {
      const { error } = await supabase.from('task_status_sets').update(payload).eq('id', found.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('task_status_sets').insert(payload)
      if (error) throw error
    }
    return { statuses: clone(statuses), templateKey }
  },

  /** The user's saved (custom) templates. */
  async listTemplates(ownerId) {
    if (!isSupabaseConfigured) {
      return read(TPL_KEY).filter((tpl) => tpl.owner_id === ownerId || !tpl.owner_id)
    }
    const { data, error } = await supabase
      .from('task_status_templates').select('*').eq('owner_id', ownerId).order('created_at')
    if (error) throw error
    return data || []
  },

  /** Save the current status set as a reusable named template. */
  async saveTemplate({ ownerId, name, statuses }) {
    const clean = { owner_id: ownerId, name: (name || 'My template').trim() || 'My template', statuses }
    if (!isSupabaseConfigured) {
      const rows = read(TPL_KEY)
      const row = { id: `tpl-${Math.random().toString(36).slice(2, 9)}`, created_at: new Date().toISOString(), ...clean }
      rows.push(row)
      write(TPL_KEY, rows)
      return row
    }
    const { data, error } = await supabase.from('task_status_templates').insert(clean).select().single()
    if (error) throw error
    return data
  },

  async deleteTemplate(id) {
    if (!isSupabaseConfigured) {
      write(TPL_KEY, read(TPL_KEY).filter((tpl) => tpl.id !== id))
      return
    }
    const { error } = await supabase.from('task_status_templates').delete().eq('id', id)
    if (error) throw error
  }
}
