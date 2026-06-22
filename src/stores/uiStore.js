/**
 * uiStore.js
 * ----------------------------------------------------------------------------
 * Global UI state that isn't tied to a feature: the light/dark theme and the
 * mobile sidebar drawer. Theme is persisted to localStorage and applied by
 * toggling `data-theme` on <html> (see variables.css for the token overrides).
 */

import { defineStore } from 'pinia'

const THEME_KEY = 'studysync_theme'
const COLLAPSE_KEY = 'studysync_sidebar_collapsed'

export const useUiStore = defineStore('ui', {
  state: () => ({
    theme: 'light',
    sidebarOpen: false, // mobile off-canvas drawer
    sidebarCollapsed: localStorage.getItem(COLLAPSE_KEY) === '1' // desktop minimise
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
    /** Desktop: minimise/expand the sidebar (persisted). */
    toggleCollapse() {
      this.sidebarCollapsed = !this.sidebarCollapsed
      localStorage.setItem(COLLAPSE_KEY, this.sidebarCollapsed ? '1' : '0')
    }
  }
})
