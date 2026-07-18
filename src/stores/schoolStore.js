/**
 * schoolStore.js
 * ----------------------------------------------------------------------------
 * The signed-in user's school (if any) + its roster and class directory. Backed
 * by schoolService (demo localStorage / live Supabase). Routes actions through
 * useAuthStore() for the current user, like the other option stores.
 */

import { defineStore } from 'pinia'
import { schoolService } from '../services/schoolService.js'
import { useAuthStore } from './authStore.js'

export const useSchoolStore = defineStore('school', {
  state: () => ({
    school: null,      // the user's school (with myRole), or null
    teachers: [],
    students: [],
    classes: [],
    loading: false,
    loaded: false
  }),

  getters: {
    hasSchool: (state) => Boolean(state.school),
    teacherCount: (state) => state.teachers.length,
    studentCount: (state) => state.students.length,
    classCount: (state) => state.classes.length
  },

  actions: {
    async loadSchool() {
      const auth = useAuthStore()
      this.loading = true
      try {
        this.school = await schoolService.getSchoolForUser(auth.user?.id)
        if (this.school) await this.loadDirectory()
      } finally {
        this.loading = false
        this.loaded = true
      }
    },

    async loadDirectory() {
      if (!this.school) return
      const [teachers, students, classes] = await Promise.all([
        schoolService.listMembers(this.school.id, 'teacher'),
        schoolService.listMembers(this.school.id, 'student'),
        schoolService.listClasses(this.school.id)
      ])
      this.teachers = teachers
      this.students = students
      this.classes = classes
    },

    async createSchool(name) {
      const auth = useAuthStore()
      this.school = await schoolService.createSchool({
        adminId: auth.user?.id,
        adminName: auth.user?.full_name,
        name
      })
      await this.loadDirectory()
      return this.school
    },

    async joinByCode(code, role) {
      const auth = useAuthStore()
      this.school = await schoolService.joinByCode({
        code,
        userId: auth.user?.id,
        userName: auth.user?.full_name,
        role: role || (auth.isTeacher ? 'teacher' : 'student')
      })
      await this.loadDirectory()
      return this.school
    },

    async removeMember(member) {
      await schoolService.removeMember(member)
      this.teachers = this.teachers.filter((m) => m.id !== member.id)
      this.students = this.students.filter((m) => m.id !== member.id)
    }
  }
})
