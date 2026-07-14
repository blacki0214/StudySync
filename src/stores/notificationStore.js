/**
 * notificationStore.js
 * ----------------------------------------------------------------------------
 * The bell's notification centre. Notifications are DERIVED (no extra table):
 *   • Deadline alerts — dated tasks/assignments due soon or overdue, from
 *     scheduleStore.
 *   • Activity — the cross-feature activity feed already loaded in contentStore.
 * Read-state is persisted in localStorage so the unread badge clears and stays
 * cleared across reloads. Works identically in demo and live mode.
 */

import { defineStore } from 'pinia'
import { useScheduleStore } from './scheduleStore.js'
import { useContentStore } from './contentStore.js'

const READ_KEY = 'studysync_notif_read'
const PREFS_KEY = 'studysync_notif_prefs'

function loadRead() {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]'))
  } catch {
    return new Set()
  }
}
function saveRead(set) {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...set])) } catch { /* ignore */ }
}
function loadPrefs() {
  try { return { deadlines: true, activity: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') } }
  catch { return { deadlines: true, activity: true } }
}

function isoDate(d) {
  const x = d instanceof Date ? d : new Date(d)
  const y = x.getFullYear()
  const m = String(x.getMonth() + 1).padStart(2, '0')
  const day = String(x.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
// Whole days from today's date to an ISO date (negative = in the past).
function daysUntil(iso) {
  const a = new Date(isoDate(new Date()) + 'T00:00:00')
  const b = new Date(iso + 'T00:00:00')
  return Math.round((b - a) / 86400000)
}

export const useNotificationStore = defineStore('notifications', {
  state: () => ({
    open: false,
    built: false,
    readIds: loadRead(),
    deadlineItems: [],
    // User notification preferences (Settings → Notifications).
    prefs: loadPrefs()
  }),

  getters: {
    /** Deadline alerts first (actionable), then the activity stream. */
    items(state) {
      const content = useContentStore()
      const activityItems = state.prefs.activity ? (content.activities || []).map((a) => ({
        id: `act-${a.id}`,
        kind: 'activity',
        icon: a.icon || 'bi-bell',
        color: a.color || '#6366f1',
        actorId: a.actorId,
        key: a.key,
        params: a.params || {},
        ago: a.ago,
        to: a.to
      })) : []
      return [...state.deadlineItems, ...activityItems]
    },
    unreadCount(state) {
      return this.items.filter((i) => !state.readIds.has(i.id)).length
    }
  },

  actions: {
    /** Build the derived deadline alerts (soon or overdue, not done). */
    async build() {
      const schedule = useScheduleStore()
      const content = useContentStore()
      await content.ensureLoaded()
      if (!schedule.loaded) await schedule.load()

      const items = []
      for (const ev of (this.prefs.deadlines ? schedule.events : [])) {
        if (ev.done) continue
        const days = daysUntil(ev.date)
        if (days > 3) continue // only surface soon/overdue
        items.push({
          id: `due-${ev.id}`,
          kind: 'deadline',
          title: ev.title,
          subject: ev.subject,
          days,
          overdue: days < 0,
          icon: ev.kind === 'assignment' ? 'bi-easel2' : 'bi-check2-square',
          color: days < 0 ? '#f97316' : days === 0 ? '#d946ef' : '#6366f1',
          to: ev.to
        })
      }
      items.sort((a, b) => a.days - b.days) // most overdue / soonest first
      this.deadlineItems = items
      this.built = true
    },

    async toggle() {
      this.open = !this.open
      if (this.open && !this.built) await this.build()
    },
    close() { this.open = false },

    markAllRead() {
      const set = new Set(this.readIds)
      this.items.forEach((i) => set.add(i.id))
      this.readIds = set
      saveRead(set)
    },
    markRead(id) {
      const set = new Set(this.readIds)
      set.add(id)
      this.readIds = set
      saveRead(set)
    },

    /** Update a notification preference (Settings) and rebuild the feed. */
    setPref(key, value) {
      this.prefs = { ...this.prefs, [key]: value }
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs)) } catch { /* ignore */ }
      this.built = false // force a rebuild on next open
    }
  }
})
