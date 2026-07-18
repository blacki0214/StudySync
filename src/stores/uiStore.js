/**
 * uiStore.js
 * ----------------------------------------------------------------------------
 * Global UI state that isn't tied to a feature: the light/dark theme and the
 * mobile sidebar drawer. Theme is persisted to localStorage and applied by
 * toggling `data-theme` on <html> (see variables.css for the token overrides).
 */

import { defineStore } from 'pinia'

const THEME_KEY = 'studysync_theme'
const MODE_KEY = 'studysync_sidebar_mode'
const MODES = ['full', 'mini']

export const useUiStore = defineStore('ui', {
  state: () => ({
    theme: 'light',
    sidebarOpen: false, // mobile off-canvas drawer
    // Desktop sidebar size: 'full' (labels) | 'mini' (icons only)
    sidebarMode: MODES.includes(localStorage.getItem(MODE_KEY)) ? localStorage.getItem(MODE_KEY) : 'mini'
  }),

  getters: {
    isDark: (state) => state.theme === 'dark'
  },

  actions: {
    /**
     * Apply the saved theme, or default to LIGHT so the app opens matching the
     * Figma design. (We intentionally don't auto-follow the OS dark preference;
     * users opt into dark via the top-bar toggle.) Call once on app start.
     */
    initTheme() {
      this.theme = localStorage.getItem(THEME_KEY) || 'light'
      this.applyTheme()
    },

    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
      localStorage.setItem(THEME_KEY, this.theme)
      this.applyTheme()
    },

    applyTheme() {
      document.documentElement.setAttribute('data-theme', this.theme)
    },

    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
    },
    closeSidebar() {
      this.sidebarOpen = false
    },
    /** Desktop: set the sidebar size mode ('full' | 'mini'), persisted. */
    setSidebarMode(mode) {
      if (!MODES.includes(mode)) return
      this.sidebarMode = mode
      localStorage.setItem(MODE_KEY, mode)
    }
  }
})
