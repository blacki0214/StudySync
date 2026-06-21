/**
 * documentService.js
 * ----------------------------------------------------------------------------
 * CRUD for the documents (sources) added into a subject workspace. Live mode
 * stores rows in the `documents` table and uploads the raw file to the private
 * `documents` Storage bucket; demo mode keeps everything (including the already-
 * extracted text) in localStorage so the workspace works fully offline.
 *
 * Text extraction itself happens in the component via utils/documentExtractor —
 * this service only persists the result.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const DEMO_KEY = 'studysync_demo_documents'
let counter = 7000
const nextId = () => `doc-${++counter}`

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
function sanitize(name) {
  return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
}

export const documentService = {
  /** List a subject's documents, newest first. */
  async listBySubject(subjectId) {
    if (!isSupabaseConfigured) {
      return readDemo()
        .filter((d) => d.subject_id === subjectId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('subject_id', subjectId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  /**
   * Create a document from already-extracted text. Pass `file` (live mode only)
   * to also upload the original to Storage.
   */
  async createDocument({ subjectId, ownerId, title, sourceType = 'text', sourceUrl = null, text = '', file = null }) {
    const row = {
      subject_id: subjectId,
      owner_id: ownerId,
      title: (title || 'Untitled source').trim(),
      source_type: sourceType,
      source_url: sourceUrl,
      extracted_text: text,
      char_count: text.length,
      status: 'ready'
    }

    if (!isSupabaseConfigured) {
      const full = { id: nextId(), file_path: null, visibility: 'private', created_at: new Date().toISOString(), ...row }
      const list = readDemo()
      list.unshift(full)
      writeDemo(list)
      return full
    }

    let file_path = null
    if (file) {
      const path = `${ownerId}/${Date.now()}-${sanitize(file.name)}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file)
      if (!upErr) file_path = path
      // If the upload fails we still keep the extracted text (graceful degrade).
    }

    const { data, error } = await supabase.from('documents').insert({ ...row, file_path }).select().single()
    if (error) throw error
    return data
  },

  /** Delete a document (and its stored file, if any). */
  async deleteDocument(doc) {
    const id = typeof doc === 'string' ? doc : doc.id
    if (!isSupabaseConfigured) {
      writeDemo(readDemo().filter((d) => d.id !== id))
      return
    }
    if (doc?.file_path) {
      await supabase.storage.from('documents').remove([doc.file_path])
    }
    const { error } = await supabase.from('documents').delete().eq('id', id)
    if (error) throw error
  }
}
