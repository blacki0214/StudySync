/**
 * scheduleStore.js
 * ----------------------------------------------------------------------------
 * Aggregates the user's dated tasks and their classes' assignment deadlines
 * into a single normalized `events` list the Schedule calendar renders. Works
 * live (Supabase) or in demo. Each event:
 *   { id, kind:'task'|'assignment', title, date:'YYYY-MM-DD', time, subject,
 *     color, done, priority, to }
 */

import { defineStore } from 'pinia'
import { scheduleService } from '../services/scheduleService.js'
import { assignmentService } from '../services/assignmentService.js'
import { useAuthStore } from './authStore.js'
import { useClassStore } from './classStore.js'
import { useContentStore } from './contentStore.js'
import { isDoneStatus } from '../utils/taskStatusTemplates.js'

/** Local YYYY-MM-DD for a Date or an ISO/date string (avoids UTC shifting). */
function isoDate(value) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const useScheduleStore = defineStore('schedule', {
  state: () => ({
    events: [],
    loading: false,
    loaded: false
  }),

  getters: {
    /** Events on a given YYYY-MM-DD. */
    byDate: (state) => (iso) => state.events.filter((e) => e.date === iso),
    /** A Set of YYYY-MM-DD strings that have at least one event. */
    datesWithEvents: (state) => new Set(state.events.map((e) => e.date)),
    /** Upcoming, not-done events from today on, soonest first. */
    upcoming: (state) => {
      const today = isoDate(new Date())
      return state.events
        .filter((e) => e.date >= today && !e.done)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 12)
    }
  },

  actions: {
    async load() {
      const auth = useAuthStore()
      const classes = useClassStore()
      const content = useContentStore()
      this.loading = true
      try {
        await content.ensureLoaded()
        const [tasks] = await Promise.all([
          scheduleService.listDatedTasks({ userId: auth.user?.id }),
          classes.fetchAll().catch(() => {})
        ])

        const events = []

        // --- Tasks (due_date is a YYYY-MM-DD string) ---
        for (const t of tasks) {
          if (!t.due_date) continue
          const subj = content.subjectById(t.subject_id)
          events.push({
            id: `task-${t.id}`,
            kind: 'task',
            title: t.title,
            date: isoDate(t.due_date),
            time: '',
            subject: subj?.code || '',
            color: subj?.color || 'grad-blue',
            done: isDoneStatus(t.status),
            priority: t.priority || 'medium',
            to: t.subject_id
              ? { name: 'subject-workspace', params: { id: t.subject_id } }
              : { name: 'tasks' }
          })
        }

        // --- Class assignments (due_at is a timestamp) ---
        const classList = [...(classes.owned || []), ...(classes.enrolled || [])]
        const perClass = await Promise.all(
          classList.map((c) => assignmentService.listByClass(c.id).catch(() => []))
        )
        classList.forEach((c, i) => {
          for (const a of perClass[i]) {
            if (!a.due_at) continue
            events.push({
              id: `asg-${a.id}`,
              kind: 'assignment',
              title: a.title,
              date: isoDate(a.due_at),
              time: new Date(a.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              subject: c.name || c.code || '',
              color: 'grad-fuchsia',
              done: false,
              priority: 'high',
              to: { name: 'class-detail', params: { id: c.id } }
            })
          }
        })

        events.sort((a, b) => a.date.localeCompare(b.date))
        this.events = events
        this.loaded = true
      } finally {
        this.loading = false
      }
    }
  }
})
