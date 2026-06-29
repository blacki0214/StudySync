/**
 * studyStatsStore.js
 * ----------------------------------------------------------------------------
 * Real spaced-repetition tracking for the Flashcards page, computed from the
 * user's own Study-mode ratings. Persisted to localStorage (namespaced per
 * user) so it works in BOTH live and demo mode with no backend/RLS — the rest
 * of the app intentionally has no review pipeline yet (see DEPLOYMENT.md).
 *
 * Model: a simple Leitner box per card (0–5). Rating a card moves it between
 * boxes and schedules its next review; the KPI cards and the 7-day chart are
 * derived from the box states + the review log.
 */

import { defineStore } from 'pinia'
import { useAuthStore } from './authStore.js'

const DAY = 24 * 60 * 60 * 1000
// Days until a card in box N is due again (box 0 = due same day).
const INTERVALS = [0, 1, 2, 4, 7, 15]
const MASTERED_BOX = 4 // box ≥ this counts as "mastered"
const LOG_CAP = 1000

const storageKey = (uid) => `studysync_srs_${uid || 'guest'}`
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() }
const dayKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }
// Monday-first weekday index (0 = Mon … 6 = Sun) to match the chart labels.
const weekdayIndex = (ts) => (new Date(ts).getDay() + 6) % 7

export const useStudyStatsStore = defineStore('studyStats', {
  state: () => ({
    byCard: {}, // `${deckId}:${cardId}` -> { box, nextDue, last }
    log: [], // [{ k, deckId, r: 'again'|'hard'|'easy', ts }]
    loadedFor: null // user id the current state was loaded for
  }),

  actions: {
    /** Load this user's saved progress once (called on the Flashcards page). */
    ensureLoaded() {
      const uid = useAuthStore().user?.id || 'guest'
      if (this.loadedFor === uid) return
      this.loadedFor = uid
      this.byCard = {}
      this.log = []
      try {
        const raw = localStorage.getItem(storageKey(uid))
        if (raw) {
          const saved = JSON.parse(raw)
          this.byCard = saved.byCard || {}
          this.log = saved.log || []
        }
      } catch { /* ignore corrupt storage */ }
    },

    _persist() {
      try {
        localStorage.setItem(
          storageKey(this.loadedFor),
          JSON.stringify({ byCard: this.byCard, log: this.log })
        )
      } catch { /* storage full / unavailable — non-fatal */ }
    },

    /** Record one rating and reschedule the card (Leitner). */
    recordReview(deckId, cardId, rating) {
      const k = `${deckId}:${cardId}`
      const cur = this.byCard[k] || { box: 0 }
      let box = cur.box || 0
      if (rating === 'again') box = 0
      else if (rating === 'easy') box = Math.min(INTERVALS.length - 1, box + 1)
      // 'hard' keeps the same box (just reschedules).
      const now = Date.now()
      this.byCard[k] = { box, nextDue: now + INTERVALS[box] * DAY, last: now }

      this.log.push({ k, deckId, r: rating, ts: now })
      if (this.log.length > LOG_CAP) this.log = this.log.slice(-LOG_CAP)
      this._persist()
    },

    /**
     * Derive the KPI/chart numbers for a set of decks. Reads reactive state, so
     * wrapping this in a computed() keeps the UI live as the user studies.
     */
    statsFor(decks) {
      const now = Date.now()
      const todayStart = startOfToday()
      const todayEnd = todayStart + DAY
      const weekAgo = now - 7 * DAY

      const keys = (decks || []).flatMap((d) =>
        (d.cards || []).map((c, i) => `${d.id}:${c.id ?? i}`)
      )
      const total = keys.length

      let mastered = 0
      let dueToday = 0
      for (const k of keys) {
        const s = this.byCard[k]
        if ((s?.box || 0) >= MASTERED_BOX) mastered++
        if (!s || (s.nextDue ?? 0) <= todayEnd) dueToday++ // new cards are due
      }

      const recent = this.log.filter((r) => r.ts >= weekAgo)
      const reviewedLast7 = [0, 0, 0, 0, 0, 0, 0]
      for (const r of recent) reviewedLast7[weekdayIndex(r.ts)]++

      const todayCount = this.log.filter((r) => r.ts >= todayStart).length
      const weekCount = recent.length

      // Recall = share of all reviews the user did NOT have to repeat ("again").
      const good = this.log.filter((r) => r.r !== 'again').length
      const recall = this.log.length ? Math.round((good / this.log.length) * 100) : 0

      return {
        total,
        mastered,
        dueToday,
        streak: this._streak(),
        avgRecall: recall,
        retention: recall,
        reviewedLast7,
        todayCount,
        weekCount
      }
    },

    /** Consecutive days (ending today, or yesterday if today is empty) with ≥1 review. */
    _streak() {
      const days = new Set(this.log.map((r) => dayKey(r.ts)))
      const now = Date.now()
      const has = (offset) => days.has(dayKey(now - offset * DAY))
      let start = has(0) ? 0 : has(1) ? 1 : null
      if (start === null) return 0
      let streak = 0
      for (let d = start; has(d); d++) streak++
      return streak
    }
  }
})
