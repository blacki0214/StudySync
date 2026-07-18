/**
 * slideService.js
 * ----------------------------------------------------------------------------
 * Native slide decks that belong to a class (Phase 3). A deck is an ordered list
 * of slides; a slide is a list of positioned blocks (text / image / shape).
 * Slides are stored as a jsonb array on the deck row to keep it simple.
 *
 * Demo mode persists to localStorage; live mode uses Supabase
 * (supabase/migration_slides.sql).
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const K_DECKS = 'studysync_demo_slide_decks'
let counter = 11000
const nextId = (p) => `${p}-${++counter}`

const read = () => {
  try { return JSON.parse(localStorage.getItem(K_DECKS) || '[]') } catch { return [] }
}
const write = (v) => localStorage.setItem(K_DECKS, JSON.stringify(v))

/** A blank slide with no blocks. */
export function blankSlide() {
  return { id: nextId('slide'), blocks: [] }
}

export const slideService = {
  async listDecks(classId) {
    if (!isSupabaseConfigured) {
      return read().filter((d) => d.class_id === classId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
    const { data, error } = await supabase
      .from('slide_decks').select('id, class_id, title, created_at').eq('class_id', classId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async getDeck(id) {
    if (!isSupabaseConfigured) return read().find((d) => d.id === id) || null
    const { data, error } = await supabase.from('slide_decks').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },

  async createDeck({ classId, title, ownerId }) {
    if (!isSupabaseConfigured) {
      const deck = {
        id: nextId('deck'), class_id: classId, owner_id: ownerId,
        title: (title || 'Untitled deck').trim(), slides: [blankSlide()],
        created_at: new Date().toISOString()
      }
      const list = read(); list.unshift(deck); write(list)
      return deck
    }
    const { data, error } = await supabase
      .from('slide_decks')
      .insert({ class_id: classId, owner_id: ownerId, title: (title || 'Untitled deck').trim(), slides: [{ id: nextId('slide'), blocks: [] }] })
      .select().single()
    if (error) throw error
    return data
  },

  async saveDeck(id, patch) {
    if (!isSupabaseConfigured) {
      const list = read(); const d = list.find((x) => x.id === id)
      if (d) { Object.assign(d, patch); write(list) }
      return d || null
    }
    const { data, error } = await supabase.from('slide_decks').update(patch).eq('id', id).select().single()
    if (error) throw error
    return data
  },

  async deleteDeck(id) {
    if (!isSupabaseConfigured) { write(read().filter((d) => d.id !== id)); return }
    const { error } = await supabase.from('slide_decks').delete().eq('id', id)
    if (error) throw error
  }
}
