/**
 * authStore.js
 * ----------------------------------------------------------------------------
 * Global authentication state. Wraps authService and exposes the current user
 * to the router guard and the navbar.
 */

import { defineStore, getActivePinia } from 'pinia'
import { authService } from '../services/authService.js'

// Stores that hold app-wide / device-level state (theme, transient UI) rather
// than the signed-in user's data — these must survive an account switch.
const KEEP_STORES = new Set(['auth', 'ui', 'palette', 'dialog'])

/**
 * Wipe every data-bearing Pinia store so one account never sees another's
 * cached data. Called on login/register/logout. Iterating the active Pinia
 * instance means new stores are covered automatically (no per-store upkeep).
 */
function resetUserStores() {
  const pinia = getActivePinia()
  if (!pinia) return
  pinia._s.forEach((store) => {
    if (KEEP_STORES.has(store.$id)) return
    try { store.$reset() } catch { /* not an option store — nothing to reset */ }
  })
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    loading: false,
    initialised: false,
    error: null
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.user),
    displayName: (state) => state.user?.full_name || 'Guest',
    // Role drives navigation + route guards. Defaults to 'student' when unset.
    role: (state) => state.user?.role || 'student',
    isTeacher: (state) => state.user?.role === 'teacher',
    isStudent: (state) => (state.user?.role || 'student') === 'student',
    isAdmin: (state) => state.user?.role === 'admin',
    // The default landing page per role: admins run a school, teachers teach,
    // students study. Used by the router redirect + post-login navigation.
    homePath: (state) => {
      const r = state.user?.role
      if (r === 'admin') return '/school'
      if (r === 'teacher') return '/teach'
      return '/hub'
    }
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
        if (!result.needsConfirmation && result.user) {
          // Clear any previous account's cached data before the new account loads.
          resetUserStores()
          this.user = result.user
        }
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
        const user = await authService.signIn({ email, password })
        // Clear any previous account's cached data before the new account loads.
        resetUserStores()
        this.user = user
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
      // Drop the signed-out user's cached data so the next account starts clean.
      resetUserStores()
    },

    /** Personalise the profile (name, avatar, bio, banner colour, …). */
    async updateProfile(patch) {
      const updated = await authService.updateProfile(patch)
      this.user = { ...this.user, ...updated }
      return this.user
    }
  }
})
