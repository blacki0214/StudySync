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
// Phones get the dedicated app shell (bottom tab bar + top header + More sheet);
// tablets and up keep the desktop sidebar. Kept in sync with the CSS breakpoint.
const MOBILE_QUERY = '(max-width: 768px)'

export const useUiStore = defineStore('ui', {
  state: () => ({
    theme: 'light',
    sidebarOpen: false, // mobile off-canvas drawer
    // Desktop sidebar size: 'full' (labels) | 'mini' (icons only)
    sidebarMode: MODES.includes(localStorage.getItem(MODE_KEY)) ? localStorage.getItem(MODE_KEY) : 'mini',
    // Viewport: true on phones → render the native-app mobile shell instead of
    // the sidebar. Initialised from matchMedia and kept live by initViewport().
    isMobile: typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY).matches : false,
    // Mobile "More" bottom sheet (overflow nav + settings/account).
    moreSheetOpen: false,
    _mql: null
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

    /**
     * Start tracking the viewport so `isMobile` flips live when the window
     * crosses the phone breakpoint (resize, device rotation). Call once on app
     * start. When we leave mobile, tear down any mobile-only overlays.
     */
    initViewport() {
      if (typeof window === 'undefined' || this._mql) return
      this._mql = window.matchMedia(MOBILE_QUERY)
      this.isMobile = this._mql.matches
      this._onChange = (e) => {
        this.isMobile = e.matches
        if (!e.matches) {
          this.moreSheetOpen = false
          this.sidebarOpen = false
        }
      }
      this._mql.addEventListener('change', this._onChange)
    },
    teardownViewport() {
      if (this._mql && this._onChange) this._mql.removeEventListener('change', this._onChange)
      this._mql = null
    },

    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen
    },
    closeSidebar() {
      this.sidebarOpen = false
    },
    openMore() {
      this.moreSheetOpen = true
    },
    closeMore() {
      this.moreSheetOpen = false
    },
    toggleMore() {
      this.moreSheetOpen = !this.moreSheetOpen
    },
    /** Desktop: set the sidebar size mode ('full' | 'mini'), persisted. */
    setSidebarMode(mode) {
      if (!MODES.includes(mode)) return
      this.sidebarMode = mode
      localStorage.setItem(MODE_KEY, mode)
    }
  }
})
