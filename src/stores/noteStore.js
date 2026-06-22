/**
 * noteStore.js
 * ----------------------------------------------------------------------------
 * Notes state + the orchestration brain for the COLLABORATIVE EDITOR.
 *
 * This store is where the advanced real-time requirements come together:
 *   • local editing state          -> `draft`
 *   • debounced auto-save          -> `scheduleAutoSave()` (700ms debounce)
 *   • optimistic UI update         -> we bump `version` locally before the
 *                                     server confirms, then reconcile
 *   • conflict detection           -> compares baseVersion vs DB version
 *   • online presence              -> `onlineUsers`
 *   • editing indicator            -> `typingUsers`
 *   • last edited by + versions    -> `versions`, `lastEditedBy`
 *
 * The store deliberately keeps the realtime channel handle private so views
 * only interact through clean actions (openNote / updateDraft / closeNote).
 */

import { defineStore } from 'pinia'
import { noteService } from '../services/noteService.js'
import { joinNoteChannel } from '../services/realtimeService.js'
import { useAuthStore } from './authStore.js'

// Module-scoped, non-reactive handles (timers / channel) — they must not live
// in reactive state or Vue would needlessly try to track them.
let channel = null
let saveTimer = null
let typingTimer = null
let contentTimer = null

export const useNoteStore = defineStore('notes', {
  state: () => ({
    notes: [],
    loading: false,

    // --- Active collaborative editing session ---
    activeNote: null, // the note row as last known from the server
    draft: { title: '', content: '' }, // local, unsaved editing buffer
    baseVersion: 0, // version the current draft is based on
    saving: false,
    saveStatus: 'idle', // 'idle' | 'saving' | 'saved' | 'conflict' | 'error'
    conflict: null, // { currentVersion } when a conflict is detected

    onlineUsers: [], // presence list for the active note
    typingUsers: [], // user ids currently typing
    versions: [], // version history for the active note

    // Live content the editor surface should adopt (from a peer's keystrokes or
    // an authoritative DB update). `remoteSeq` increments so the view re-applies
    // even when the html is identical.
    remoteHtml: '',
    remoteSeq: 0
  }),

  getters: {
    /** Notes belonging to a given subject. */
    bySubject: (state) => (subjectId) =>
      state.notes.filter((n) => n.subject_id === subjectId),

    /** True while there are unsaved local changes. */
    isDirty: (state) =>
      state.activeNote &&
      (state.draft.content !== state.activeNote.content ||
        state.draft.title !== state.activeNote.title)
  },

  actions: {
    async fetchNotes(subjectId) {
      this.loading = true
      try {
        this.notes = await noteService.listNotes({ subjectId })
      } finally {
        this.loading = false
      }
    },

    async createNote(payload) {
      const auth = useAuthStore()
      const note = await noteService.createNote({ ...payload, authorId: auth.user?.id })
      this.notes.unshift(note)
      return note
    },

    async deleteNote(id) {
      await noteService.deleteNote(id)
      this.notes = this.notes.filter((n) => n.id !== id)
    },

    /** Toggle the shareable link + permission for the active note. */
    async setShare({ enabled, permission }) {
      if (!this.activeNote) return
      const updated = await noteService.setShare(this.activeNote.id, { enabled, permission })
      this.activeNote = { ...this.activeNote, ...updated }
    },

    /**
     * Open a note for collaborative editing:
     *  1. Load the latest server copy + version history.
     *  2. Seed the local draft.
     *  3. Join the realtime channel (presence + remote updates + typing).
     */
    async openNote(id) {
      const auth = useAuthStore()
      this.resetEditingState()

      const note = await noteService.getNote(id)
      if (!note) throw new Error('Note not found')

      this.activeNote = note
      this.baseVersion = note.version
      this.draft = { title: note.title, content: note.content }
      this.versions = await noteService.listVersions(id)

      channel = joinNoteChannel({
        noteId: id,
        user: auth.user || { id: 'anon', full_name: 'Anonymous' },
        handlers: {
          onRemoteUpdate: (row) => this.handleRemoteUpdate(row),
          onRemoteContent: ({ html }) => this.handleRemoteContent(html),
          onPresenceChange: (users) => {
            this.onlineUsers = users
          },
          onTyping: ({ userId, isTyping }) => this.handleTypingSignal(userId, isTyping)
        }
      })
    },

    /**
     * Called on every keystroke from the editor. Updates the local draft
     * immediately (optimistic feel), signals "typing" to peers, and (re)arms the
     * debounced auto-save.
     */
    updateDraft({ title, content }) {
      if (title !== undefined) this.draft.title = title
      if (content !== undefined) this.draft.content = content

      // Tell peers we're typing (throttled so we don't spam the channel).
      if (!typingTimer) {
        channel?.broadcastTyping(true)
        typingTimer = setTimeout(() => {
          channel?.broadcastTyping(false)
          typingTimer = null
        }, 1500)
      }

      // Live-broadcast the content so peers see edits instantly (throttled).
      if (!contentTimer) {
        channel?.broadcastContent(this.draft.content)
        contentTimer = setTimeout(() => {
          channel?.broadcastContent(this.draft.content)
          contentTimer = null
        }, 200)
      }

      this.scheduleAutoSave()
    },

    /**
     * Debounced auto-save: waits 700ms after the last keystroke before writing,
     * so we batch a burst of typing into a single network round-trip.
     */
    scheduleAutoSave() {
      this.saveStatus = 'idle'
      clearTimeout(saveTimer)
      saveTimer = setTimeout(() => this.save(), 700)
    },

    /**
     * Persist the draft with version-conflict handling and optimistic update.
     */
    async save() {
      if (!this.activeNote || this.saving) return
      if (!this.isDirty) return

      this.saving = true
      this.saveStatus = 'saving'
      const auth = useAuthStore()

      try {
        const result = await noteService.saveNoteWithVersioning({
          id: this.activeNote.id,
          content: this.draft.content,
          title: this.draft.title,
          baseVersion: this.baseVersion,
          editedBy: auth.user?.id
        })

        if (result.status === 'conflict') {
          // Someone saved before us. Surface the warning; do NOT clobber.
          this.saveStatus = 'conflict'
          this.conflict = { currentVersion: result.currentVersion }
          return
        }

        // Optimistic reconcile: adopt the server's authoritative row + version.
        this.activeNote = result.note
        this.baseVersion = result.note.version
        this.saveStatus = 'saved'
        this.conflict = null

        // Refresh local list copy + version history.
        this.syncListEntry(result.note)
        this.versions = await noteService.listVersions(this.activeNote.id)
      } catch (e) {
        this.saveStatus = 'error'
      } finally {
        this.saving = false
      }
    },

    /**
     * Resolve a conflict by reloading the latest server version, then re-applying
     * the user's local edits on top of the fresh base version.
     */
    async resolveConflictKeepMine() {
      const fresh = await noteService.getNote(this.activeNote.id)
      this.activeNote = fresh
      this.baseVersion = fresh.version // rebase onto the newest version
      this.conflict = null
      this.saveStatus = 'idle'
      await this.save() // retry with the corrected base version
    },

    /** Discard local edits and accept the other user's version. */
    async resolveConflictUseTheirs() {
      const fresh = await noteService.getNote(this.activeNote.id)
      this.activeNote = fresh
      this.baseVersion = fresh.version
      this.draft = { title: fresh.title, content: fresh.content }
      this.conflict = null
      this.saveStatus = 'idle'
      this.syncListEntry(fresh)
    },

    /**
     * A remote DB update arrived for the note currently open. If the user has no
     * unsaved local changes we adopt it silently; otherwise we flag a soft
     * conflict so the editing indicator/version banner can react.
     */
    handleRemoteUpdate(row) {
      if (!this.activeNote || row.version <= this.baseVersion) return

      if (!this.isDirty) {
        this.activeNote = row
        this.baseVersion = row.version
        this.draft = { title: row.title, content: row.content }
        // Refresh the editor surface with the authoritative content.
        this.remoteHtml = row.content
        this.remoteSeq++
      } else {
        this.saveStatus = 'conflict'
        this.conflict = { currentVersion: row.version }
      }
      this.syncListEntry(row)
    },

    /**
     * A peer's live keystrokes arrived over broadcast. Surface them to the
     * editor (via remoteSeq) WITHOUT marking us dirty or scheduling a save —
     * the peer who is typing owns the save.
     */
    handleRemoteContent(html) {
      if (!this.activeNote) return
      this.remoteHtml = html
      this.remoteSeq++
    },

    handleTypingSignal(userId, isTyping) {
      const set = new Set(this.typingUsers)
      if (isTyping) set.add(userId)
      else set.delete(userId)
      this.typingUsers = [...set]
    },

    /** Keep the in-list copy of a note consistent with edits. */
    syncListEntry(note) {
      const idx = this.notes.findIndex((n) => n.id === note.id)
      if (idx !== -1) this.notes[idx] = { ...this.notes[idx], ...note }
    },

    /** Tear down the editing session and leave the realtime channel. */
    closeNote() {
      clearTimeout(saveTimer)
      clearTimeout(typingTimer)
      clearTimeout(contentTimer)
      typingTimer = null
      contentTimer = null
      channel?.leave()
      channel = null
      this.resetEditingState()
    },

    resetEditingState() {
      this.activeNote = null
      this.draft = { title: '', content: '' }
      this.baseVersion = 0
      this.saving = false
      this.saveStatus = 'idle'
      this.conflict = null
      this.onlineUsers = []
      this.typingUsers = []
      this.versions = []
    }
  }
})
