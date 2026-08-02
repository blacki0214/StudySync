/**
 * tourStore.js
 * ----------------------------------------------------------------------------
 * First-run onboarding. Three pieces, all driven from here:
 *
 *   1. The welcome dialog  — shown once, right after a new account lands in the
 *      app. Offers "Take the tour" or "Skip for now".
 *   2. The spotlight tour  — coach-marks that dim the page and cut a hole around
 *      a REAL element (a sidebar link, the search box, the AI button), so the
 *      user learns where each feature actually lives.
 *   3. The Get-started checklist on the Hub — five first tasks that tick
 *      themselves off from real data (notes written, tasks added, pages opened).
 *
 * Progress is stored per user id in localStorage, so two accounts on the same
 * device each get their own first run and one account's "done" never hides the
 * tour from the other. (This store is data-bearing, so authStore.resetUserStores
 * wipes it on account switch; App.vue then calls syncUser() to reload the new
 * user's flags.)
 */

import { defineStore } from 'pinia'
import { useAuthStore } from './authStore.js'
import { useUiStore } from './uiStore.js'

const KEY_PREFIX = 'studysync_onboarding_'
const storageKey = (userId) => `${KEY_PREFIX}${userId || 'guest'}`

function readSaved(userId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId))) || {}
  } catch {
    return {}
  }
}

/**
 * Step factory. `target` is a CSS selector for the element to spotlight — always
 * a `data-tour` hook so restyling a component never silently breaks the tour.
 * Copy lives in i18n at `tour.steps.<id>.title` / `.body`.
 * `placement` is a PREFERENCE; ProductTour flips it when there isn't room.
 */
const step = (id, target, icon, placement = 'right') => ({ id, target, icon, placement })

// The closing card — centered, no spotlight.
const FINISH = { id: 'finish', target: null, icon: 'bi-rocket-takeoff', placement: 'center' }

// ---------------------------------------------------------------------------
// Desktop tours — anchored to the sidebar rail + the floating action buttons.
// Each role only sees the nav it actually has (see AppSidebar's link lists).
// ---------------------------------------------------------------------------
const DESKTOP_TOURS = {
  student: [
    step('hub', '[data-tour="nav-hub"]', 'bi-house-door'),
    step('mySubjects', '[data-tour="nav-my-subjects"]', 'bi-folder'),
    step('notes', '[data-tour="nav-notes"]', 'bi-file-earmark-text'),
    step('tasks', '[data-tour="nav-tasks"]', 'bi-check2-square'),
    step('schedule', '[data-tour="nav-schedule"]', 'bi-calendar-week'),
    step('rooms', '[data-tour="nav-rooms"]', 'bi-people'),
    step('flashcards', '[data-tour="nav-flashcards"]', 'bi-stars'),
    step('community', '[data-tour="nav-community"]', 'bi-chat-square-text'),
    step('search', '[data-tour="search"]', 'bi-search'),
    step('ai', '[data-tour="ai"]', 'bi-stars', 'left'),
    step('help', '[data-tour="help"]', 'bi-question-lg', 'left'),
    FINISH
  ],
  teacher: [
    step('teach', '[data-tour="nav-teach"]', 'bi-easel'),
    step('classes', '[data-tour="nav-classes"]', 'bi-mortarboard'),
    step('notes', '[data-tour="nav-notes"]', 'bi-file-earmark-text'),
    step('schedule', '[data-tour="nav-schedule"]', 'bi-calendar-week'),
    step('rooms', '[data-tour="nav-rooms"]', 'bi-people'),
    step('search', '[data-tour="search"]', 'bi-search'),
    step('ai', '[data-tour="ai"]', 'bi-stars', 'left'),
    step('help', '[data-tour="help"]', 'bi-question-lg', 'left'),
    FINISH
  ],
  admin: [
    step('school', '[data-tour="nav-school"]', 'bi-building'),
    step('classes', '[data-tour="nav-classes"]', 'bi-mortarboard'),
    step('community', '[data-tour="nav-community"]', 'bi-chat-square-text'),
    step('settings', '[data-tour="nav-settings"]', 'bi-gear'),
    step('search', '[data-tour="search"]', 'bi-search'),
    step('help', '[data-tour="help"]', 'bi-question-lg', 'left'),
    FINISH
  ]
}

// ---------------------------------------------------------------------------
// Mobile tours — phones have no sidebar, so these anchor to the bottom tab bar.
// Shorter on purpose: everything not in the tab bar is behind "More", which the
// last step points at.
// ---------------------------------------------------------------------------
const MOBILE_TOURS = {
  student: [
    step('hub', '[data-tour="m-tab-hub"]', 'bi-house-door', 'top'),
    step('mySubjects', '[data-tour="m-tab-subjects"]', 'bi-grid', 'top'),
    step('notes', '[data-tour="m-tab-notes"]', 'bi-file-earmark-text', 'top'),
    step('tasks', '[data-tour="m-tab-tasks"]', 'bi-check2-square', 'top'),
    step('more', '[data-tour="m-tab-more"]', 'bi-list', 'top'),
    FINISH
  ],
  teacher: [
    step('teach', '[data-tour="m-tab-teach"]', 'bi-easel', 'top'),
    step('classes', '[data-tour="m-tab-classes"]', 'bi-mortarboard', 'top'),
    step('notes', '[data-tour="m-tab-notes"]', 'bi-file-earmark-text', 'top'),
    step('schedule', '[data-tour="m-tab-schedule"]', 'bi-calendar-week', 'top'),
    step('more', '[data-tour="m-tab-more"]', 'bi-list', 'top'),
    FINISH
  ],
  admin: [
    step('school', '[data-tour="m-tab-school"]', 'bi-building', 'top'),
    step('classes', '[data-tour="m-tab-classes"]', 'bi-mortarboard', 'top'),
    step('community', '[data-tour="m-tab-community"]', 'bi-chat-square-text', 'top'),
    step('more', '[data-tour="m-tab-more"]', 'bi-list', 'top'),
    FINISH
  ]
}

/**
 * Routes that count as "explored" for the Get-started checklist. Visiting the
 * page is enough for the items that have no data to check against.
 */
const VISIT_MILESTONES = {
  '/flashcards': 'flashcards',
  '/rooms': 'rooms',
  '/community': 'community'
}

export const useTourStore = defineStore('tour', {
  state: () => ({
    // Which user's flags are currently loaded (guards against a stale read).
    userKey: null,
    tourDone: false,
    tourSkipped: false,
    checklistDismissed: false,
    milestones: {}, // { [key]: true }

    // Live tour state.
    welcomeOpen: false,
    active: false,
    index: 0,
    steps: [],

    // Help centre (opened from the "?" button): 'faq' | 'support' | 'feedback'.
    helpOpen: false,
    helpTab: 'faq'
  }),

  getters: {
    currentStep: (state) => state.steps[state.index] || null,
    stepCount: (state) => state.steps.length,
    isFirstStep: (state) => state.index === 0,
    isLastStep: (state) => state.index >= state.steps.length - 1,
    /** True once the user has either finished or skipped the first-run tour. */
    onboarded: (state) => state.tourDone || state.tourSkipped
  },

  actions: {
    /**
     * Load the signed-in user's saved flags. Call on app start and whenever the
     * account changes — the store is reset on switch, so this repopulates it.
     */
    syncUser() {
      const auth = useAuthStore()
      const id = auth.user?.id || null
      this.userKey = id
      const saved = readSaved(id)
      this.tourDone = Boolean(saved.tourDone)
      this.tourSkipped = Boolean(saved.tourSkipped)
      this.checklistDismissed = Boolean(saved.checklistDismissed)
      this.milestones = saved.milestones || {}
    },

    _persist() {
      try {
        localStorage.setItem(
          storageKey(this.userKey),
          JSON.stringify({
            tourDone: this.tourDone,
            tourSkipped: this.tourSkipped,
            checklistDismissed: this.checklistDismissed,
            milestones: this.milestones
          })
        )
      } catch {
        /* storage full or blocked — onboarding just re-offers next visit */
      }
    },

    /**
     * Open the welcome dialog for a genuinely new user. No-op once they've
     * finished or skipped, and never while another onboarding surface is open.
     */
    maybeStartFirstRun() {
      const auth = useAuthStore()
      if (!auth.isAuthenticated) return
      if (this.onboarded || this.active || this.welcomeOpen) return
      this.welcomeOpen = true
    },

    /**
     * Resolve the step list for this role + viewport, dropping any step whose
     * element isn't on the page (a role without that nav item, a hidden FAB).
     * Resolved once at start, not in a getter — the DOM isn't reactive.
     */
    _resolveSteps() {
      const auth = useAuthStore()
      const ui = useUiStore()
      const role = auth.isAdmin ? 'admin' : auth.isTeacher ? 'teacher' : 'student'
      const tours = ui.isMobile ? MOBILE_TOURS : DESKTOP_TOURS
      return (tours[role] || tours.student).filter((s) => !s.target || document.querySelector(s.target))
    },

    /** Begin (or restart) the spotlight tour from step one. */
    startTour() {
      this.welcomeOpen = false
      this.helpOpen = false
      this.steps = this._resolveSteps()
      this.index = 0
      this.active = this.steps.length > 0
      // Nothing to point at (e.g. a stripped-down layout) — don't trap the user
      // behind an empty overlay; treat it as completed instead.
      if (!this.active) this.completeTour()
    },

    next() {
      if (this.isLastStep) this.completeTour()
      else this.index += 1
    },
    back() {
      if (!this.isFirstStep) this.index -= 1
    },
    goTo(i) {
      if (i >= 0 && i < this.steps.length) this.index = i
    },

    /** "Skip tour" / Esc — remembered, so it isn't offered again on next login. */
    skipTour() {
      this.active = false
      this.welcomeOpen = false
      this.tourSkipped = true
      this._persist()
    },

    completeTour() {
      this.active = false
      this.welcomeOpen = false
      this.tourDone = true
      this._persist()
    },

    // --- Get-started checklist ---------------------------------------------

    /** Record a one-off milestone (used for "explored" checklist items). */
    markMilestone(key) {
      if (!key || this.milestones[key]) return
      this.milestones = { ...this.milestones, [key]: true }
      this._persist()
    },

    /** Called from the router: turn a visited path into a milestone. */
    noteVisit(path) {
      const key = VISIT_MILESTONES[path]
      if (key) this.markMilestone(key)
    },

    dismissChecklist() {
      this.checklistDismissed = true
      this._persist()
    },
    showChecklist() {
      this.checklistDismissed = false
      this._persist()
    },

    // --- Help centre --------------------------------------------------------

    openHelp(tab = 'faq') {
      this.helpTab = tab
      this.helpOpen = true
    },
    closeHelp() {
      this.helpOpen = false
    }
  }
})
