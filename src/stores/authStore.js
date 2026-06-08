/**
 * authStore.js
 * ----------------------------------------------------------------------------
 * Global authentication state. Wraps authService and exposes the current user
 * to the router guard and the navbar.
 */

import { defineStore } from 'pinia'
import { authService } from '../services/authService.js'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    loading: false,
    initialised: false,
    error: null
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.user),
    displayName: (state) => state.user?.full_name || 'Guest'
  },

  actions: {
    /** Restore the session on app start (called once from main.js / guard). */
    async init() {
      if (this.initialised) return
      this.loading = true
      try {
        this.user = await authService.getCurrentUser()
      } catch (e) {
        this.user = null
      } finally {
        this.initialised = true
        this.loading = false
      }
    },

    async register({ email, password, fullName }) {
      this.loading = true
      this.error = null
      try {
        this.user = await authService.signUp({ email, password, fullName })
        return this.user
      } catch (e) {
        this.error = e.message || 'Registration failed.'
        throw e
      } finally {
        this.loading = false
      }
    },

    async login({ email, password }) {
      this.loading = true
      this.error = null
      try {
        this.user = await authService.signIn({ email, password })
        return this.user
      } catch (e) {
        this.error = e.message || 'Invalid email or password.'
        throw e
      } finally {
        this.loading = false
      }
    },

    async logout() {
      await authService.signOut()
      this.user = null
    }
  }
})
