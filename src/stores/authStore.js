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

    async register(payload) {
      this.loading = true
      this.error = null
      try {
        const result = await authService.signUp(payload)
        // Only mark as signed-in when a session exists (i.e. no email
        // confirmation needed, or demo mode).
        if (!result.needsConfirmation && result.user) this.user = result.user
        return result
      } catch (e) {
        this.error = e.message || 'Registration failed.'
        throw e
      } finally {
        this.loading = false
      }
    },

    /** Send a password-reset email. */
    async requestPasswordReset(email) {
      this.loading = true
      this.error = null
      try {
        await authService.requestPasswordReset(email)
      } catch (e) {
        this.error = e.message || 'Could not send the reset email.'
        throw e
      } finally {
        this.loading = false
      }
    },

    /** Set a new password after following the reset link. */
    async updatePassword(newPassword) {
      this.loading = true
      this.error = null
      try {
        await authService.updatePassword(newPassword)
      } catch (e) {
        this.error = e.message || 'Could not update the password.'
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
