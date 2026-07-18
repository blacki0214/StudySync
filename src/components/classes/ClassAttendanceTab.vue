<script setup>
/**
 * ClassAttendanceTab — teacher marks attendance per session date (Phase 5).
 * Toggling a student saves immediately. Roster is passed in from the class view.
 */
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { classActivityService } from '../../services/classActivityService.js'

const props = defineProps({
  classId: { type: String, required: true },
  roster: { type: Array, default: () => [] }
})
const { t } = useI18n()

const today = new Date().toISOString().slice(0, 10)
const date = ref(today)
const present = ref({}) // user_id -> boolean

onMounted(loadDate)
watch(date, loadDate)

async function loadDate() {
  const rows = await classActivityService.getAttendance(props.classId, date.value)
  present.value = Object.fromEntries(rows.map((r) => [r.user_id, r.present]))
}
function initials(name) { return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() }
function name(m) { return m.full_name || m.profile?.full_name || 'Student' }

async function toggle(m) {
  const next = !present.value[m.user_id]
  present.value = { ...present.value, [m.user_id]: next }
  await classActivityService.setAttendance({ classId: props.classId, date: date.value, userId: m.user_id, present: next })
}
</script>

<template>
  <div>
    <div class="tab-toolbar att-toolbar">
      <label class="att-date-label">{{ t('attend.date') }}</label>
      <input v-model="date" type="date" class="form-control att-date" />
      <span class="roster-spacer"></span>
      <span class="att-count">{{ t('attend.presentCount', { n: Object.values(present).filter(Boolean).length, total: roster.length }) }}</span>
    </div>

    <p v-if="!roster.length" class="rail-empty-lg">{{ t('attend.noStudents') }}</p>
    <div v-else class="panel roster">
      <div v-for="m in roster" :key="m.id" class="roster-row att-row">
        <span class="disc-avatar att-av">{{ initials(name(m)) }}</span>
        <span class="roster-name">{{ name(m) }}</span>
        <span class="roster-spacer"></span>
        <button class="att-toggle" :class="{ on: present[m.user_id] }" @click="toggle(m)">
          <i class="bi" :class="present[m.user_id] ? 'bi-check-circle-fill' : 'bi-circle'"></i>
          {{ present[m.user_id] ? t('attend.present') : t('attend.absent') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.att-toolbar { display: flex; align-items: center; gap: var(--space-3); }
.att-date-label { font-size: 0.85rem; color: var(--c-text-muted); font-weight: 600; }
.att-date { width: auto; }
.att-count { font-size: 0.85rem; color: var(--c-text-muted); font-weight: 600; }
.att-row { align-items: center; gap: var(--space-3); }
.att-av { width: 30px; height: 30px; }
.att-toggle { display: inline-flex; align-items: center; gap: 0.4rem; border: 1px solid var(--c-border-strong); background: var(--c-surface); color: var(--c-text-muted); border-radius: var(--radius-pill); padding: 0.3rem 0.8rem; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
.att-toggle.on { background: rgba(16,185,129,.14); color: var(--c-green); border-color: transparent; }
</style>
