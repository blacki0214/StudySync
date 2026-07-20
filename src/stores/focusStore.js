/**
 * focusStore.js
 * ----------------------------------------------------------------------------
 * Real focus-time tracking, measured from time actually spent on the study
 * surfaces (notes, flashcards, study rooms, subject workspaces).
 *
 * Persisted to localStorage namespaced per user — the same approach as
 * studyStatsStore — so it works identically in live, demo and test-account
 * mode with no backend or RLS involved.
 *
 * Model: one row per finished stretch of focus, `{ s: startMs, m: minutes,
 * w: surface }`. The Hub's weekly chart is derived from those rows; nothing is
 * stored pre-aggregated, so the series is always correct for "the last 7 days"
 * regardless of when it is read.
 */

import { defineStore } from 'pinia'
import { useAuthStore } from './authStore.js'

const DAY = 24 * 60 * 60 * 1000
const LOG_CAP = 2000

/** Stretches shorter than this are noise (a mis-click through a page). */
const MIN_SESSION_MS = 30 * 1000
/** Ignore a gap longer than this — the user walked away, it isn't focus. */
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000

const storageKey = (uid) => `studysync_focus_${uid || 'guest'}`
const startOfDay = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime() }

export const useFocusStore = defineStore('focus', {
  state: () => ({
    sessions: [], // [{ s: startMs, m: minutes, w: surface }]
    loadedFor: null
  }),

  getters: {
    /** Total minutes recorded in the last 7 days (including today). */
    minutesLast7(state) {
      const from = startOfDay(Date.now()) - 6 * DAY
      return state.sessions.reduce((sum, r) => (r.s >= from ? sum + r.m : sum), 0)
    },

    /** Whole hours this week, for the "N hours this week" subtitle. */
    hoursLast7() {
      return Math.round((this.minutesLast7 / 60) * 10) / 10
    },

    /**
     * The Hub chart series: the last 7 days ending today, oldest first.
     * Values are hours (1 decimal) so the y-axis reads naturally.
     */
    weeklySeries(state) {
      const today = startOfDay(Date.now())
      const buckets = Array.from({ length: 7 }, (_, i) => ({ day: today - (6 - i) * DAY, mins: 0 }))
      for (const r of state.sessions) {
        const idx = Math.round((startOfDay(r.s) - buckets[0].day) / DAY)
        if (idx >= 0 && idx < 7) buckets[idx].mins += r.m
      }
      const values = buckets.map((b) => Math.round((b.mins / 60) * 10) / 10)
      return {
        labels: buckets.map((b) => new Date(b.day).toLocaleDateString(undefined, { weekday: 'short' })),
        values,
        max: Math.max(...values, 1)
      }
    },

    /** Minutes per surface over the last 7 days — powers the breakdown chips. */
    bySurfaceLast7(state) {
      const from = startOfDay(Date.now()) - 6 * DAY
      const out = {}
      for (const r of state.sessions) {
        if (r.s < from) continue
        out[r.w] = (out[r.w] || 0) + r.m
      }
      return out
    }
  },

  actions: {
    /** Load this user's saved sessions once. Safe to call repeatedly. */
    ensureLoaded() {
      const uid = useAuthStore().user?.id || 'guest'
      if (this.loadedFor === uid) return
      this.loadedFor = uid
      this.sessions = []
      try {
        const raw = localStorage.getItem(storageKey(uid))
        if (raw) this.sessions = JSON.parse(raw) || []
      } catch { /* ignore corrupt storage */ }
    },

    _persist() {
      try {
        localStorage.setItem(storageKey(this.loadedFor), JSON.stringify(this.sessions))
      } catch { /* storage full / unavailable — non-fatal */ }
    },

    /**
     * Record a finished stretch of focus.
     * @param {string} surface  'notes' | 'flashcards' | 'room' | 'workspace'
     * @param {number} ms       measured active milliseconds
     * @param {number} [startedAt] when it began (defaults to now - ms)
     */
    recordFocus(surface, ms, startedAt = Date.now() - ms) {
      if (!Number.isFinite(ms) || ms < MIN_SESSION_MS) return
      this.ensureLoaded()
      const minutes = Math.round((ms / 60000) * 10) / 10

      // Merge into the previous row when it is the same surface and adjacent in
      // time, so navigating within one feature stays a single session.
      const last = this.sessions[this.sessions.length - 1]
      if (last && last.w === surface && startedAt - (last.s + last.m * 60000) < IDLE_TIMEOUT_MS) {
        last.m = Math.round((last.m + minutes) * 10) / 10
      } else {
        this.sessions.push({ s: startedAt, m: minutes, w: surface })
      }

      if (this.sessions.length > LOG_CAP) this.sessions = this.sessions.slice(-LOG_CAP)
      this._persist()
    },

    /** Drop everything older than 90 days — keeps storage bounded. */
    prune() {
      const cutoff = Date.now() - 90 * DAY
      const before = this.sessions.length
      this.sessions = this.sessions.filter((r) => r.s >= cutoff)
      if (this.sessions.length !== before) this._persist()
    }
  }
})
