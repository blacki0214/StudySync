/**
 * subjectStore.js
 * ----------------------------------------------------------------------------
 * Subjects list + the currently selected subject. Reads/writes go through
 * subjectService so demo mode (sample data + localStorage) and live mode share
 * one code path. Users can now create their own personal subjects (workspaces).
 */

import { defineStore } from 'pinia'
import { subjectService } from '../services/subjectService.js'
import { useAuthStore } from './authStore.js'

export const useSubjectStore = defineStore('subjects', {
  state: () => ({
    subjects: [],
    loading: false
  }),

  getters: {
    categories: (state) => [...new Set(state.subjects.map((s) => s.category))],
    getById: (state) => (id) => state.subjects.find((s) => s.id === id) || null,
    getByCode: (state) => (code) => state.subjects.find((s) => s.code === code) || null,
    /** Subjects owned by the signed-in user (their personal workspaces). */
    mySubjects: (state) => {
      const auth = useAuthStore()
      return state.subjects.filter((s) => s.owner_id && s.owner_id === auth.user?.id)
    }
  },

  actions: {
    async fetchSubjects() {
      const auth = useAuthStore()
      this.loading = true
      try {
        // Public catalog + the user's own subjects (never others' private ones).
        this.subjects = await subjectService.listAll({ userId: auth.user?.id })
      } finally {
        this.loading = false
      }
    },

    async createSubject(payload) {
      const auth = useAuthStore()
      const row = await subjectService.createSubject({ ...payload, ownerId: auth.user?.id })
      this.subjects.unshift(row)
      return row
    },

    /** Update a subject and reconcile the local copy (rename, icon, sharing…). */
    async updateSubject(id, patch) {
      const updated = await subjectService.updateSubject(id, patch)
      const row = this.subjects.find((s) => s.id === id)
      if (row) Object.assign(row, updated || patch)
      return row
    },

    /** Toggle whether a personal subject is shared to the public catalog. */
    async setShared(id, shared) {
      return this.updateSubject(id, { visibility: shared ? 'public' : 'private' })
    },

    async deleteSubject(id) {
      await subjectService.deleteSubject(id)
      this.subjects = this.subjects.filter((s) => s.id !== id)
    }
  }
})
