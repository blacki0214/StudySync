/**
 * commentService.js
 * ----------------------------------------------------------------------------
 * Inline comment threads for a note. The highlighted span lives in the document
 * (CommentMark, synced via Yjs); the body/author/quote live here and sync live
 * via Supabase Realtime. Demo mode persists to localStorage.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const DEMO_KEY = 'studysync_demo_comments'
let counter = 11000
const nextId = () => `cmt-${++counter}`
const read = () => { try { return JSON.parse(localStorage.getItem(DEMO_KEY) || '[]') } catch { return [] } }
const write = (v) => localStorage.setItem(DEMO_KEY, JSON.stringify(v))

export const commentService = {
  async list(noteId) {
    if (!isSupabaseConfigured) {
      return read().filter((c) => c.note_id === noteId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    }
    const { data, error } = await supabase
      .from('note_comments').select('*').eq('note_id', noteId).order('created_at')
    if (error) throw error
    return data
  },

  async add({ noteId, commentId, authorId, authorName, quote, body }) {
    const row = { comment_id: commentId, note_id: noteId, author_id: authorId, author_name: authorName, quote, body, resolved: false }
    if (!isSupabaseConfigured) {
      const full = { id: nextId(), created_at: new Date().toISOString(), ...row }
      const list = read(); list.push(full); write(list)
      return full
    }
    const { data, error } = await supabase.from('note_comments').insert(row).select().single()
    if (error) throw error
    return data
  },

  async remove(id) {
    if (!isSupabaseConfigured) { write(read().filter((c) => c.id !== id)); return }
    const { error } = await supabase.from('note_comments').delete().eq('id', id)
    if (error) throw error
  },

  /** Subscribe to live comment changes for a note. Returns an unsubscribe fn. */
  subscribe(noteId, onChange) {
    if (!isSupabaseConfigured) return () => {}
    const ch = supabase
      .channel(`comments:${noteId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'note_comments', filter: `note_id=eq.${noteId}` }, () => onChange())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }
}
