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
  /** All subjects visible in the catalog (seed/public + user-created). */
  async listAll() {
    if (!isSupabaseConfigured) {
      return [...readDemo(), ...sampleSubjects]
    }
    const { data, error } = await supabase.from('subjects').select('*').order('code', { ascending: true })
    if (error) throw error
    return data
  },

  /** Create a personal subject owned by the current user. */
  async createSubject({ name, description = '', category = 'Personal', color = 'grad-blue', ownerId }) {
    const trimmed = (name || '').trim()
    const base = {
      code: codeFrom(trimmed),
      letters: lettersFrom(trimmed),
      color,
      name: trimmed,
      description,
      category,
      rating: 0,
      notes_count: 0,
      students: 1,
      progress: 0,
      owner_id: ownerId,
      owner_type: 'personal',
      visibility: 'private'
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
