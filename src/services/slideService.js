/**
 * slideService.js
 * ----------------------------------------------------------------------------
 * Class slide decks (Phase 3). Decks are UPLOADED files (PDF / PPTX) that can be
 * presented in-app: PDFs render fullscreen page-by-page via pdf.js; PPTX can be
 * downloaded. Simple and reliable — no in-app authoring needed.
 *
 * Demo mode persists to localStorage (file stored as a data URL); live mode uses
 * Supabase + the `slides` storage bucket (supabase/migration_slides.sql).
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const K_DECKS = 'studysync_demo_slide_decks'
let counter = 11000
const nextId = (p) => `${p}-${++counter}`

const read = () => {
  try { return JSON.parse(localStorage.getItem(K_DECKS) || '[]') } catch { return [] }
}
const write = (v) => localStorage.setItem(K_DECKS, JSON.stringify(v))

export const slideService = {
  async listDecks(classId) {
    if (!isSupabaseConfigured) {
      return read().filter((d) => d.class_id === classId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
    const { data, error } = await supabase
      .from('slide_decks').select('id, class_id, title, file_url, file_type, created_at').eq('class_id', classId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async createDeck({ classId, title, fileUrl, fileType, ownerId }) {
    if (!isSupabaseConfigured) {
      const deck = {
        id: nextId('deck'), class_id: classId, owner_id: ownerId,
        title: (title || 'Untitled deck').trim(), file_url: fileUrl, file_type: fileType,
        created_at: new Date().toISOString()
      }
      const list = read(); list.unshift(deck); write(list)
      return deck
    }
    const { data, error } = await supabase
      .from('slide_decks')
      .insert({ class_id: classId, owner_id: ownerId, title: (title || 'Untitled deck').trim(), file_url: fileUrl, file_type: fileType })
      .select().single()
    if (error) throw error
    return data
  },

  async deleteDeck(id) {
    if (!isSupabaseConfigured) { write(read().filter((d) => d.id !== id)); return }
    const { error } = await supabase.from('slide_decks').delete().eq('id', id)
    if (error) throw error
  },

  /**
   * Upload a slide file to Storage (live) and return its public URL. Falls back
   * to an inline data URL in demo mode or if the bucket is unavailable.
   */
  async uploadSlideFile(file, ownerId) {
    if (isSupabaseConfigured && supabase) {
      try {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${ownerId || 'anon'}/${Date.now()}-${safe}`
        const { error } = await supabase.storage.from('slides').upload(path, file)
        if (!error) {
          const { data } = supabase.storage.from('slides').getPublicUrl(path)
          if (data?.publicUrl) return data.publicUrl
        }
      } catch { /* fall through to data URL */ }
    }
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }
}
