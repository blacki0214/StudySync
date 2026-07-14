<script setup>
/**
 * UpcomingSchedule — the Hub's "what's next" panel: the soonest upcoming,
 * not-done task/assignment deadlines from the schedule (per-user).
 */
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScheduleStore } from '../../stores/scheduleStore.js'

const { t } = useI18n()
const schedule = useScheduleStore()

onMounted(() => { if (!schedule.loaded) schedule.load() })

const events = computed(() => schedule.upcoming.slice(0, 5))

/** Local YYYY-MM-DD (no UTC shift). */
function iso(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const today = iso(new Date())
const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return iso(d) })()

function whenLabel(dateStr) {
  if (dateStr === today) return t('hub.today')
  if (dateStr === tomorrow) return t('hub.tomorrow')
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="panel hub-widget">
    <div class="hub-widget-head">
      <div class="section-title section-title-flush"><i class="bi bi-calendar-week"></i>{{ t('hub.upcoming') }}</div>
      <router-link to="/schedule" class="link-more">{{ t('common.viewAll') }}<i class="bi bi-chevron-right"></i></router-link>
    </div>

    <p v-if="!events.length" class="hub-widget-empty">{{ t('hub.noUpcoming') }}</p>

    <router-link v-for="e in events" :key="e.id" :to="e.to" class="hub-item">
      <span class="hub-item-icon" :class="e.color || 'grad-blue'">
        <i class="bi" :class="e.kind === 'assignment' ? 'bi-journal-check' : 'bi-check2-square'"></i>
      </span>
      <div class="hub-item-body">
        <div class="hub-item-title">{{ e.title }}</div>
        <div class="hub-item-meta"><template v-if="e.subject">{{ e.subject }} · </template>{{ whenLabel(e.date) }}<template v-if="e.time"> · {{ e.time }}</template></div>
      </div>
      <span v-if="e.priority === 'high'" class="hub-item-tag due">{{ t('tasks.priority.high') }}</span>
    </router-link>
  </div>
</template>
