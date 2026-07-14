/**
 * subjectService.js
 * ----------------------------------------------------------------------------
 * Reads the subject catalog and lets users CREATE their own (personal) subjects
 * — the workspace they add documents into. Follows the demo-mode gate: when no
 * Supabase is configured it works against the bundled sample data plus a
 * localStorage list of user-created subjects so everything survives a reload.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { sampleSubjects } from '../data/sampleSubjects.js'

const DEMO_KEY = 'studysync_demo_subjects'
let demoCounter = 5000
const nextId = () => `subj-${++demoCounter}`

function readDemo() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) || '[]')
  } catch {
    return []
  }
}
function writeDemo(list) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(list))
}

/** First three alphabetic chars, uppercased — for the coloured letter badge. */
function lettersFrom(name) {
  const clean = (name || '').replace(/[^a-zA-Z]/g, '')
  return (clean.slice(0, 3) || 'SUB').toUpperCase()
}
/** A short, human-ish code from the name + a few random chars. */
function codeFrom(name) {
  const base = (name || 'SUBJ').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'SUBJ'
  const rand = Math.floor(1000 + Math.abs(hash(name)) % 9000)
  return `${base}${rand}`
}
function hash(s) {
  let h = 0
  for (let i = 0; i < (s || '').length; i++) h = (h << 5) - h + s.charCodeAt(i)
  return h
}

export const subjectService = {
  /**
   * Subjects visible to a user: the public/seed catalog PLUS their own personal
   * subjects — but never another user's private ones. The table is public-read
   * at the RLS level, so this scoping must happen in the query. Pass `userId`.
   */
  async listAll({ userId } = {}) {
    if (!isSupabaseConfigured) {
      return [...readDemo(), ...sampleSubjects]
    }
    let query = supabase.from('subjects').select('*').order('code', { ascending: true })
    // Public/seed (owner_id null or visibility public) + the user's own subjects.
    query = userId
      ? query.or(`owner_id.is.null,visibility.eq.public,owner_id.eq.${userId}`)
      : query.or('owner_id.is.null,visibility.eq.public')
    const { data, error } = await query
    if (error) throw error
    return data
  },

  /**
   * Create a personal subject owned by the current user.
   * @param {object} input
   * @param {string} [input.icon]    bi-icon name or uploaded image data-URL
   * @param {boolean} [input.shared] true = visible in the public/community catalog
   */
  async createSubject({ name, description = '', category = 'Personal', color = 'grad-blue', icon = null, shared = false, ownerId }) {
    const trimmed = (name || '').trim()
    const base = {
      code: codeFrom(trimmed),
      letters: lettersFrom(trimmed),
      color,
      icon: icon || null,
      name: trimmed,
      description,
      category: (category || 'Personal').trim() || 'Personal',
      rating: 0,
      notes_count: 0,
      students: 1,
      progress: 0,
      owner_id: ownerId,
      owner_type: 'personal',
      visibility: shared ? 'public' : 'private'
    }

    if (!isSupabaseConfigured) {
      const row = { id: nextId(), ...base, created_at: new Date().toISOString() }
      const list = readDemo()
      list.unshift(row)
      writeDemo(list)
      return row
    }

    const { data, error } = await supabase.from('subjects').insert(base).select().single()
    if (error) throw error
    return data
  },

  /**
   * Update a subject the user owns (rename, recolor, change icon/category, or
   * toggle sharing via `visibility`). RLS restricts live updates to the owner.
   */
  async updateSubject(id, patch = {}) {
    if (!isSupabaseConfigured) {
      const list = readDemo()
      const row = list.find((s) => s.id === id)
      if (row) { Object.assign(row, patch); writeDemo(list) }
      return row || null
    }
    const { data, error } = await supabase.from('subjects').update(patch).eq('id', id).select().single()
    if (error) throw error
    return data
  },

  /** Delete a subject (only the owner can, enforced by RLS in live mode). */
  async deleteSubject(id) {
    if (!isSupabaseConfigured) {
      writeDemo(readDemo().filter((s) => s.id !== id))
      return
    }
    const { error } = await supabase.from('subjects').delete().eq('id', id)
    if (error) throw error
  }
}
