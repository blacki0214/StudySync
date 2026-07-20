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
import { taskStatusService } from '../services/taskStatusService.js'
import { useAuthStore } from './authStore.js'
import { DEFAULT_STATUSES, isDoneStatus } from '../utils/taskStatusTemplates.js'

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    tasks: [],
    loading: false,
    scope: { subjectId: null }, // the scope currently loaded

    // Customizable statuses for the current board (ClickUp-style).
    statuses: DEFAULT_STATUSES(),
    statusTemplateKey: 'basic',
    statusTemplates: [], // the user's saved custom templates

    _unsub: null
  }),

  getters: {
    byStatus: (state) => (status) =>
      state.tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position),
    statusById: (state) => (id) => state.statuses.find((s) => s.id === id) || null,
    /** First status id — the default a brand-new task starts in. */
    defaultStatusId: (state) => state.statuses[0]?.id || 'not_started',
    /** Statuses grouped by their lifecycle group, in group order. */
    statusesByGroup: (state) => (group) => state.statuses.filter((s) => s.group === group),
    counts: (state) => {
      const activeIds = new Set(state.statuses.filter((s) => s.group === 'active').map((s) => s.id))
      const done = state.tasks.filter((t) => isDoneStatus(t.status, state.statuses)).length
      const in_progress = state.tasks.filter((t) => activeIds.has(t.status)).length
      const total = state.tasks.length
      return { not_started: Math.max(total - done - in_progress, 0), in_progress, done, total }
    }
  },

  actions: {
    async load({ subjectId = null } = {}) {
      const auth = useAuthStore()
      this.loading = true
      this.scope = { subjectId }
      try {
        const [tasks, set, templates] = await Promise.all([
          taskService.list({ subjectId, ownerId: auth.user?.id }),
          taskStatusService.getStatusSet({ subjectId, ownerId: auth.user?.id }),
          taskStatusService.listTemplates(auth.user?.id).catch(() => [])
        ])
        this.tasks = tasks
        this.statuses = set.statuses
        this.statusTemplateKey = set.templateKey
        this.statusTemplates = templates
      } finally {
        this.loading = false
      }
      // (Re)subscribe to live changes for this scope.
      this._unsub?.()
      this._unsub = taskService.subscribe({ subjectId, ownerId: auth.user?.id }, () => this.refresh())
    },

    /** Persist a new status set for this board and adopt it locally. */
    async saveStatuses(statuses, templateKey = null) {
      const auth = useAuthStore()
      this.statuses = statuses
      this.statusTemplateKey = templateKey
      await taskStatusService.saveStatusSet({ subjectId: this.scope.subjectId, ownerId: auth.user?.id, statuses, templateKey })
      // Any task whose status was removed falls back to the first status.
      const valid = new Set(statuses.map((s) => s.id))
      for (const task of this.tasks) {
        if (!valid.has(task.status)) this.update(task.id, { status: this.defaultStatusId })
      }
    },

    /** Save the current status set as a reusable named template. */
    async saveStatusTemplate(name) {
      const auth = useAuthStore()
      const row = await taskStatusService.saveTemplate({ ownerId: auth.user?.id, name, statuses: this.statuses })
      this.statusTemplates.push(row)
      return row
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
        status: this.defaultStatusId,
        position,
        ...patch
      })
      this.tasks.push(row)
      return row
    },

    /**
     * Bulk-create tasks from parsed import patches (see utils/taskImport.js).
     * Positions continue after the current list so imported tasks land at the
     * bottom in order. Returns the number actually created.
     */
    async importTasks(patches = []) {
      const auth = useAuthStore()
      let position = this.tasks.length
      let created = 0
      for (const p of patches) {
        try {
          const row = await taskService.create({
            subjectId: this.scope.subjectId,
            ownerId: auth.user?.id,
            assigneeName: auth.user?.full_name || null,
            status: p.status || this.defaultStatusId,
            priority: p.priority || 'medium',
            type: p.type || 'general',
            dueDate: p.dueDate || null,
            description: p.description || '',
            title: p.title,
            position: position++
          })
          if (row) { this.tasks.push(row); created++ }
        } catch { /* skip the failed row, keep importing the rest */ }
      }
      return created
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
