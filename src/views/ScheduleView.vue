<script setup>
/**
 * ScheduleView — a month calendar of the user's deadlines. It aggregates dated
 * tasks (personal + subject) and class-assignment due dates via scheduleStore,
 * with an "Upcoming" agenda rail. Month grid is computed locally (no date lib);
 * styling is semantic classes in styles/schedule.css.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScheduleStore } from '../stores/scheduleStore.js'

const { t, locale } = useI18n()
const schedule = useScheduleStore()

const today = new Date()
const todayIso = iso(today)
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth()) // 0-11
const selected = ref(todayIso)

function iso(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

onMounted(() => { if (!schedule.loaded) schedule.load() })

const monthLabel = computed(() =>
  new Date(viewYear.value, viewMonth.value, 1).toLocaleDateString(locale.value, { month: 'long', year: 'numeric' })
)

// Monday-first weekday headers, localised.
const weekdays = computed(() => {
  const ref0 = new Date(2024, 0, 1) // a Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ref0)
    d.setDate(ref0.getDate() + i)
    return d.toLocaleDateString(locale.value, { weekday: 'short' })
  })
})

// 6 weeks × 7 days covering the visible month (Monday-first).
const weeks = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1)
  const lead = (first.getDay() + 6) % 7 // days before the 1st (Mon=0)
  const start = new Date(viewYear.value, viewMonth.value, 1 - lead)
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const isoStr = iso(d)
    return {
      iso: isoStr,
      day: d.getDate(),
      inMonth: d.getMonth() === viewMonth.value,
      isToday: isoStr === todayIso,
      events: schedule.byDate(isoStr)
    }
  })
  return Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7))
})

const selectedEvents = computed(() => schedule.byDate(selected.value))
const selectedLabel = computed(() =>
  new Date(selected.value + 'T00:00:00').toLocaleDateString(locale.value, { weekday: 'long', month: 'long', day: 'numeric' })
)

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}
function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}
function goToday() {
  viewYear.value = today.getFullYear()
  viewMonth.value = today.getMonth()
  selected.value = todayIso
}
</script>

<template>
  <div>
    <header class="page-head">
      <div>
        <h1 class="ph-title">{{ t('schedule.title') }}</h1>
        <p class="ph-sub">{{ t('schedule.sub') }}</p>
      </div>
      <div class="action-row">
        <button class="btn btn-outline-soft btn-sm" @click="goToday">{{ t('schedule.today') }}</button>
        <router-link to="/tasks" class="btn btn-brand btn-sm"><i class="bi bi-check2-square"></i>{{ t('schedule.openTasks') }}</router-link>
      </div>
    </header>

    <div class="schedule-layout">
      <!-- Calendar -->
      <div class="cal-card">
        <div class="cal-head">
          <button class="cal-nav" :aria-label="t('schedule.prev')" @click="prevMonth"><i class="bi bi-chevron-left"></i></button>
          <div class="cal-month">{{ monthLabel }}</div>
          <button class="cal-nav" :aria-label="t('schedule.next')" @click="nextMonth"><i class="bi bi-chevron-right"></i></button>
        </div>

        <div class="cal-weekdays">
          <span v-for="w in weekdays" :key="w">{{ w }}</span>
        </div>

        <div class="cal-grid">
          <template v-for="(week, wi) in weeks" :key="wi">
            <button
              v-for="cell in week"
              :key="cell.iso"
              class="cal-cell"
              :class="{ 'out-month': !cell.inMonth, today: cell.isToday, selected: cell.iso === selected }"
              @click="selected = cell.iso"
            >
              <span class="cc-day">{{ cell.day }}</span>
              <span class="cc-events">
                <span
                  v-for="ev in cell.events.slice(0, 3)"
                  :key="ev.id"
                  class="cc-chip"
                  :class="[{ done: ev.done }, !ev.statusColor && ev.color]"
                  :style="ev.statusColor ? { background: ev.statusColor + '22', color: ev.statusColor, borderLeft: '3px solid ' + ev.statusColor } : null"
                  :title="ev.statusName ? ev.title + ' · ' + ev.statusName : ev.title"
                >{{ ev.title }}</span>
                <span v-if="cell.events.length > 3" class="cc-more">+{{ cell.events.length - 3 }}</span>
              </span>
            </button>
          </template>
        </div>
      </div>

      <!-- Agenda rail -->
      <div class="agenda-rail">
        <div class="panel">
          <div class="section-title"><i class="bi bi-calendar-day"></i>{{ selectedLabel }}</div>
          <p v-if="!selectedEvents.length" class="rail-empty-lg">{{ t('schedule.noneOnDay') }}</p>
          <router-link v-for="ev in selectedEvents" :key="ev.id" :to="ev.to" class="agenda-item">
            <span class="ai-tick" :class="!ev.statusColor && ev.color" :style="ev.statusColor ? { background: ev.statusColor } : null"><i class="bi" :class="ev.kind === 'assignment' ? 'bi-easel2' : 'bi-check2-square'"></i></span>
            <div class="ai-main">
              <div class="ai-title" :class="{ done: ev.done }">{{ ev.title }}</div>
              <div class="ai-meta">
                <span v-if="ev.statusName" class="ai-status" :style="{ background: ev.statusColor + '22', color: ev.statusColor }"><span class="ai-status-dot" :style="{ background: ev.statusColor }"></span>{{ ev.statusName }}</span>
                <span v-if="ev.subject" class="badge-outline">{{ ev.subject }}</span>
                <span class="ai-kind">{{ ev.kind === 'assignment' ? t('schedule.assignment') : t('schedule.task') }}</span>
                <span v-if="ev.time" class="ai-time">{{ ev.time }}</span>
              </div>
            </div>
          </router-link>
        </div>

        <div class="panel">
          <div class="section-title"><i class="bi bi-hourglass-split"></i>{{ t('schedule.upcoming') }}</div>
          <p v-if="schedule.loading" class="rail-empty-lg"><i class="bi bi-arrow-repeat spin"></i> {{ t('schedule.loading') }}</p>
          <p v-else-if="!schedule.upcoming.length" class="rail-empty-lg">{{ t('schedule.noUpcoming') }}</p>
          <router-link v-for="ev in schedule.upcoming" :key="ev.id" :to="ev.to" class="up-row" @click="selected = ev.date">
            <span class="up-dot" :class="!ev.statusColor && ev.color" :style="ev.statusColor ? { background: ev.statusColor } : null"></span>
            <div class="up-main">
              <div class="up-title" :class="{ done: ev.done }">{{ ev.title }}</div>
              <div class="up-sub">
                <span v-if="ev.subject">{{ ev.subject }}</span>
                <span v-if="ev.statusName" class="up-status" :style="{ color: ev.statusColor }">{{ ev.subject ? ' · ' : '' }}{{ ev.statusName }}</span>
              </div>
            </div>
            <span class="up-date">{{ new Date(ev.date + 'T00:00:00').toLocaleDateString(locale, { month: 'short', day: 'numeric' }) }}</span>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
