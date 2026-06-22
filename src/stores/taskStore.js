/**
 * taskStore.js
 * ----------------------------------------------------------------------------
 * Holds the tasks for the currently-viewed scope (personal or one subject) and
 * routes all reads/writes through taskService so demo and live mode share one
 * code path. Updates are optimistic; a realtime subscription keeps subject
 * boards in sync across collaborators.
 */

import { defineStore } from 'pinia'
import { taskService } from '../services/taskService.js'
import { useAuthStore } from './authStore.js'

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    tasks: [],
    loading: false,
    scope: { subjectId: null }, // the scope currently loaded
    _unsub: null
  }),

  getters: {
    byStatus: (state) => (status) =>
      state.tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position),
    counts: (state) => ({
      not_started: state.tasks.filter((t) => t.status === 'not_started').length,
      in_progress: state.tasks.filter((t) => t.status === 'in_progress').length,
      done: state.tasks.filter((t) => t.status === 'done').length,
      total: state.tasks.length
    })
  },

  actions: {
    async load({ subjectId = null } = {}) {
      const auth = useAuthStore()
      this.loading = true
      this.scope = { subjectId }
      try {
        this.tasks = await taskService.list({ subjectId, ownerId: auth.user?.id })
      } finally {
        this.loading = false
      }
      // (Re)subscribe to live changes for this scope.
      this._unsub?.()
      this._unsub = taskService.subscribe({ subjectId, ownerId: auth.user?.id }, () => this.refresh())
    },

    async refresh() {
      const auth = useAuthStore()
      try {
        this.tasks = await taskService.list({ subjectId: this.scope.subjectId, ownerId: auth.user?.id })
      } catch { /* keep current */ }
    },

    async create(patch = {}) {
      const auth = useAuthStore()
      const position = this.tasks.length
      const row = await taskService.create({
        subjectId: this.scope.subjectId,
        ownerId: auth.user?.id,
        assigneeName: auth.user?.full_name || null,
        position,
        ...patch
      })
      this.tasks.push(row)
      return row
    },

    async update(id, patch) {
      // Optimistic: apply locally first, then persist.
      const row = this.tasks.find((t) => t.id === id)
      const prev = row ? { ...row } : null
      if (row) Object.assign(row, patch)
      try {
        await taskService.update(id, patch)
      } catch {
        if (row && prev) Object.assign(row, prev) // roll back on failure
      }
    },

    async remove(id) {
      const idx = this.tasks.findIndex((t) => t.id === id)
      const removed = idx >= 0 ? this.tasks.splice(idx, 1)[0] : null
      try {
        await taskService.remove(id)
      } catch {
        if (removed) this.tasks.splice(idx, 0, removed) // restore on failure
      }
    },

    teardown() {
      this._unsub?.()
      this._unsub = null
    }
  }
})
