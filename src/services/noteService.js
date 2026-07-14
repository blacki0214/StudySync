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
  /**
   * List notes, optionally filtered by subject and/or class.
   *
   * IMPORTANT — per-user scoping: the `notes` table grants public read at the
   * RLS level, so a bare select returns EVERY user's notes. Pass `authorId` to
   * restrict the list to the current user's own notes (otherwise a new account
   * would see notes created by other/previous accounts). Demo mode is a single
   * local user, so it keeps showing the bundled sample notes.
   */
  async listNotes({ subjectId, classId, authorId } = {}) {
    if (!isSupabaseConfigured) {
      let notes = demoNotes
      if (subjectId) notes = notes.filter((n) => n.subject_id === subjectId)
      if (classId) notes = notes.filter((n) => n.class_id === classId)
      return [...notes].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    }

    let query = supabase.from('notes').select('*').order('updated_at', { ascending: false })
    if (authorId) query = query.eq('author_id', authorId)
    if (subjectId) query = query.eq('subject_id', subjectId)
    if (classId) query = query.eq('class_id', classId)
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
  async createNote({ subjectId, classId = null, authorId, title, content, visibility = 'public' }) {
    const now = new Date().toISOString()
    if (!isSupabaseConfigured) {
      const note = {
        id: nextDemoId('note'),
        subject_id: subjectId,
        class_id: classId,
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
        class_id: classId,
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

  /**
   * Persist the collaborative editor's content. With CRDT (Yjs) merging there's
   * no version conflict to resolve, so this is a straight write of the rendered
   * HTML + the encoded Yjs state.
   */
  async saveNote({ id, content, ydoc = null }) {
    const now = new Date().toISOString()
    if (!isSupabaseConfigured) {
      const note = demoNotes.find((n) => n.id === id)
      if (note) { note.content = content; note.updated_at = now }
      return
    }
    const patch = { content, updated_at: now }
    if (ydoc != null) patch.ydoc = ydoc
    const { error } = await supabase.from('notes').update(patch).eq('id', id)
    if (error) throw error
  },

  /** Rename a note (lightweight title-only write). */
  async renameNote(id, title) {
    const now = new Date().toISOString()
    if (!isSupabaseConfigured) {
      const note = demoNotes.find((n) => n.id === id)
      if (note) { note.title = title; note.updated_at = now }
      return
    }
    const { error } = await supabase.from('notes').update({ title, updated_at: now }).eq('id', id)
    if (error) throw error
  },

  /** Enable/disable a shareable link and set its permission (read|edit). */
  async setShare(id, { enabled, permission }) {
    if (!isSupabaseConfigured) {
      const note = demoNotes.find((n) => n.id === id)
      if (note) { note.share_enabled = enabled; note.share_permission = permission }
      return { share_enabled: enabled, share_permission: permission }
    }
    const { data, error } = await supabase
      .from('notes')
      .update({ share_enabled: enabled, share_permission: permission })
      .eq('id', id)
      .select('share_enabled, share_permission')
      .single()
    if (error) throw error
    return data
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

  /** List the version history for a note, newest first (with author info). */
  async listVersions(noteId) {
    if (!isSupabaseConfigured) {
      return [...(demoVersions[noteId] || [])].sort(
        (a, b) => b.version_number - a.version_number
      )
    }
    const { data, error } = await supabase
      .from('note_versions')
      .select('*, author:profiles(full_name)')
      .eq('note_id', noteId)
      .order('version_number', { ascending: false })
    if (error) throw error
    return data
  },

  /**
   * Append a version snapshot tagged with who edited and when (for the edit
   * history / diff view). version_number auto-increments per note.
   */
  async addVersion({ noteId, content, editedBy, authorName, summary = '' }) {
    if (!isSupabaseConfigured) {
      const list = (demoVersions[noteId] ||= [])
      const vn = (list.reduce((m, v) => Math.max(m, v.version_number), 0) || 0) + 1
      const row = {
        id: nextDemoId('ver'), note_id: noteId, content, version_number: vn,
        summary, edited_by: editedBy, author: { full_name: authorName }, created_at: new Date().toISOString()
      }
      list.push(row)
      return row
    }
    const { data: last } = await supabase
      .from('note_versions').select('version_number').eq('note_id', noteId)
      .order('version_number', { ascending: false }).limit(1).maybeSingle()
    const vn = (last?.version_number || 0) + 1
    const { data, error } = await supabase
      .from('note_versions')
      .insert({ note_id: noteId, content, version_number: vn, summary, edited_by: editedBy })
      .select('*, author:profiles(full_name)').single()
    if (error) throw error
    return data
  },

  /**
   * Subscribe to live version-history changes for a note so collaborators' new
   * snapshots appear without a reload. Returns an unsubscribe fn (no-op in demo).
   */
  subscribeVersions(noteId, onChange) {
    if (!isSupabaseConfigured) return () => {}
    const ch = supabase
      .channel(`versions:${noteId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'note_versions', filter: `note_id=eq.${noteId}` }, () => onChange())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }
}
