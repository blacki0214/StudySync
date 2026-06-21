/**
 * documentStore.js
 * ----------------------------------------------------------------------------
 * Holds the documents for the subject workspaces that have been opened, keyed by
 * subject id. Thin layer over documentService (which handles the demo/live gate).
 */

import { defineStore } from 'pinia'
import { documentService } from '../services/documentService.js'
import { useAuthStore } from './authStore.js'

export const useDocumentStore = defineStore('documents', {
  state: () => ({
    bySubject: {}, // { [subjectId]: Document[] }
    loading: false
  }),

  getters: {
    forSubject: (state) => (subjectId) => state.bySubject[subjectId] || []
  },

  actions: {
    async fetchForSubject(subjectId) {
      this.loading = true
      try {
        this.bySubject = { ...this.bySubject, [subjectId]: await documentService.listBySubject(subjectId) }
      } finally {
        this.loading = false
      }
    },

    async addDocument({ subjectId, title, sourceType, sourceUrl, text, file }) {
      const auth = useAuthStore()
      const row = await documentService.createDocument({
        subjectId,
        ownerId: auth.user?.id,
        title,
        sourceType,
        sourceUrl,
        text,
        file
      })
      const current = this.bySubject[subjectId] || []
      this.bySubject = { ...this.bySubject, [subjectId]: [row, ...current] }
      return row
    },

    async removeDocument(subjectId, doc) {
      await documentService.deleteDocument(doc)
      const id = typeof doc === 'string' ? doc : doc.id
      this.bySubject = {
        ...this.bySubject,
        [subjectId]: (this.bySubject[subjectId] || []).filter((d) => d.id !== id)
      }
    }
  }
})
