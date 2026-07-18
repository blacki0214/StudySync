/**
 * classStore.js
 * ----------------------------------------------------------------------------
 * Teacher-owned classes + the classes a student has joined. Detail data (roster,
 * announcements) is read on demand in the view via classService; this store
 * holds the two lists and the create/join/delete actions.
 */

import { defineStore } from 'pinia'
import { classService } from '../services/classService.js'
import { useAuthStore } from './authStore.js'
import { useSchoolStore } from './schoolStore.js'

export const useClassStore = defineStore('classes', {
  state: () => ({
    owned: [],
    enrolled: [],
    loading: false
  }),

  actions: {
    async fetchOwned() {
      const auth = useAuthStore()
      this.owned = await classService.listMyClasses(auth.user?.id)
    },
    async fetchEnrolled() {
      const auth = useAuthStore()
      this.enrolled = await classService.listEnrolledClasses(auth.user?.id)
    },
    async fetchAll() {
      this.loading = true
      try {
        await Promise.all([this.fetchOwned(), this.fetchEnrolled()])
      } finally {
        this.loading = false
      }
    },

    async createClass(payload) {
      const auth = useAuthStore()
      const school = useSchoolStore()
      // Link the class to the teacher's school (if they belong to one) so it
      // appears in the school's class directory.
      const schoolId = payload.schoolId ?? school.school?.id ?? null
      const row = await classService.createClass({ ...payload, ownerId: auth.user?.id, schoolId })
      this.owned.unshift(row)
      return row
    },

    async joinByCode(code) {
      const auth = useAuthStore()
      const cls = await classService.joinByCode({
        code,
        userId: auth.user?.id,
        userName: auth.user?.full_name
      })
      if (!this.enrolled.some((c) => c.id === cls.id)) this.enrolled.unshift(cls)
      return cls
    },

    async deleteClass(id) {
      await classService.deleteClass(id)
      this.owned = this.owned.filter((c) => c.id !== id)
    }
  }
})
