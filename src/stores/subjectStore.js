/**
 * subjectStore.js
 * ----------------------------------------------------------------------------
 * Subjects list + the currently selected subject. Falls back to sample data in
 * demo mode via the same service pattern.
 */

import { defineStore } from 'pinia'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import { sampleSubjects } from '../data/sampleSubjects.js'

export const useSubjectStore = defineStore('subjects', {
  state: () => ({
    subjects: [],
    loading: false
  }),

  getters: {
    categories: (state) => [...new Set(state.subjects.map((s) => s.category))],
    getById: (state) => (id) => state.subjects.find((s) => s.id === id) || null,
    getByCode: (state) => (code) => state.subjects.find((s) => s.code === code) || null
  },

  actions: {
    async fetchSubjects() {
      this.loading = true
      try {
        if (!isSupabaseConfigured) {
          this.subjects = [...sampleSubjects]
          return
        }
        const { data, error } = await supabase
          .from('subjects')
          .select('*')
          .order('code', { ascending: true })
        if (error) throw error
        this.subjects = data
      } finally {
        this.loading = false
      }
    }
  }
})
