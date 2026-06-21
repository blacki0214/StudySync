/**
 * paletteStore.js
 * ----------------------------------------------------------------------------
 * Open/closed state for the global ⌘K command palette. Kept in a tiny Pinia
 * store (like uiStore for theme/sidebar) so the global keydown listener in
 * App.vue, the navbar search trigger, and the palette component all share one
 * source of truth. The searchable index + keyboard navigation live inside
 * CommandPalette.vue.
 */

import { defineStore } from 'pinia'

export const usePaletteStore = defineStore('palette', {
  state: () => ({
    open: false
  }),
  actions: {
    show() {
      this.open = true
    },
    hide() {
      this.open = false
    },
    toggle() {
      this.open = !this.open
    }
  }
})
