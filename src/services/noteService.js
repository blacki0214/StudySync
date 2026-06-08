/**
 * noteService.js
 * ----------------------------------------------------------------------------
 * CRUD for notes + note versions. In demo mode it operates on an in-memory copy
 * of the sample notes so create/update/delete all work during a presentation.
 *
 * The version-control logic (saveNoteWithVersioning) is the backbone of the
 * collaborative editor: it performs an OPTIMISTIC-CONCURRENCY check against the
 * stored version number before writing, and snapshots every save into
 * note_versions for the version-history feature.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { sampleNotes } from '../data/sampleNotes.js'

// Mutable in-memory store for demo mode (deep-cloned so we never mutate imports).
let demoNotes = sampleNotes.map((n) => ({ ...n }))
const demoVersions = {} // noteId -> array of version snapshots

let demoIdCounter = 1000
const nextDemoId = (prefix) => `${prefix}-${++demoIdCounter}`

export const noteService = {
  /** List notes, optionally filtered by subject. */
  async listNotes({ subjectId } = {}) {
    if (!isSupabaseConfigured) {
      const notes = subjectId
        ? demoNotes.filter((n) => n.subject_id === subjectId)
        : demoNotes
      return [...notes].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    }

    let query = supabase.from('notes').select('*').order('updated_at', { ascending: false })
    if (subjectId) query = query.eq('subject_id', subjectId)
    const { data, error } = await query
    if (error) throw error
    return data
  },

  /** Fetch a single note by id. */
  async getNote(id) {
    if (!isSupabaseConfigured) {
      return demoNotes.find((n) => n.id === id) || null
    }
    const { data, error } = await supabase.from('notes').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },

  /** Create a new note (version starts at 1). */
  async createNote({ subjectId, authorId, title, content, visibility = 'public' }) {
    const now = new Date().toISOString()
    if (!isSupabaseConfigured) {
      const note = {
        id: nextDemoId('note'),
        subject_id: subjectId,
        author_id: authorId,
        title,
        content,
        visibility,
        likes_count: 0,
        version: 1,
        updated_at: now,
        created_at: now
      }
      demoNotes.unshift(note)
      return note
    }

    const { data, error } = await supabase
      .from('notes')
      .insert({
        subject_id: subjectId,
        author_id: authorId,
        title,
        content,
        visibility,
        likes_count: 0,
        version: 1
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  /**
   * Save an edited note WITH optimistic-concurrency version control.
   *
   * @param {object} params
   * @param {string} params.id            note id
   * @param {string} params.content       new content
   * @param {string} params.title         new title
   * @param {number} params.baseVersion   version the editor STARTED from
   * @param {string} params.editedBy      user id performing the save
   * @returns {Promise<{status:'saved'|'conflict', note?:object, currentVersion?:number}>}
   *
   * If the database version no longer equals `baseVersion`, somebody else saved
   * first: we return {status:'conflict'} and let the UI prompt the user.
   */
  async saveNoteWithVersioning({ id, content, title, baseVersion, editedBy }) {
    const now = new Date().toISOString()

    if (!isSupabaseConfigured) {
      const note = demoNotes.find((n) => n.id === id)
      if (!note) throw new Error('Note not found')

      // Conflict check.
      if (note.version !== baseVersion) {
        return { status: 'conflict', currentVersion: note.version, note: { ...note } }
      }

      // Snapshot the previous content into version history first.
      ;(demoVersions[id] ||= []).push({
        id: nextDemoId('ver'),
        note_id: id,
        content: note.content,
        version_number: note.version,
        edited_by: editedBy,
        created_at: now
      })

      note.content = content
      note.title = title ?? note.title
      note.version = baseVersion + 1
      note.updated_at = now
      return { status: 'saved', note: { ...note } }
    }

    // --- Live Supabase path ---------------------------------------------
    // 1. Re-read current version to detect conflicts.
    const { data: current, error: readErr } = await supabase
      .from('notes')
      .select('version, content')
      .eq('id', id)
      .single()
    if (readErr) throw readErr

    if (current.version !== baseVersion) {
      return { status: 'conflict', currentVersion: current.version }
    }

    // 2. Snapshot the previous content into note_versions.
    await supabase.from('note_versions').insert({
      note_id: id,
      content: current.content,
      version_number: current.version,
      edited_by: editedBy
    })

    // 3. Conditional update: only succeeds if version still matches (guards
    //    against a race between our read and write).
    const { data: updated, error: updateErr } = await supabase
      .from('notes')
      .update({ content, title, version: baseVersion + 1, updated_at: now })
      .eq('id', id)
      .eq('version', baseVersion)
      .select()
      .single()

    if (updateErr || !updated) {
      // The conditional update matched no row -> a concurrent save won.
      const { data: latest } = await supabase
        .from('notes')
        .select('version')
        .eq('id', id)
        .single()
      return { status: 'conflict', currentVersion: latest?.version ?? baseVersion }
    }

    return { status: 'saved', note: updated }
  },

  /** Delete a note. */
  async deleteNote(id) {
    if (!isSupabaseConfigured) {
      demoNotes = demoNotes.filter((n) => n.id !== id)
      return
    }
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) throw error
  },

  /** List the version history for a note, newest first. */
  async listVersions(noteId) {
    if (!isSupabaseConfigured) {
      return [...(demoVersions[noteId] || [])].sort(
        (a, b) => b.version_number - a.version_number
      )
    }
    const { data, error } = await supabase
      .from('note_versions')
      .select('*')
      .eq('note_id', noteId)
      .order('version_number', { ascending: false })
    if (error) throw error
    return data
  }
}
