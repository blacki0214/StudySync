<script setup>
/**
 * ClassGradebookTab — teacher overview of scores: students (rows) × assignments
 * (columns). Built from all submissions across the class's assignments.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { assignmentService } from '../../services/assignmentService.js'
import EmptyState from '../common/EmptyState.vue'

const props = defineProps({ classId: { type: String, required: true } })
const { t } = useI18n()

const assignments = ref([])
const subs = ref([])
const loading = ref(true)

onMounted(async () => {
  assignments.value = await assignmentService.listByClass(props.classId)
  subs.value = await assignmentService.classSubmissions(props.classId)
  loading.value = false
})

// Rows: one per student who has submitted anything.
const rows = computed(() => {
  const byUser = new Map()
  for (const s of subs.value) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, { name: s.user?.full_name || 'Student', scores: {} })
    byUser.get(s.user_id).scores[s.assignment_id] = s
  }
  return [...byUser.values()]
})

function cell(row, a) {
  const s = row.scores[a.id]
  if (!s) return '—'
  if (s.total != null) return `${s.score}/${s.total}`
  return t('classes.ungraded')
}
function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
  <div>
    <div v-if="loading" class="text-muted-sm">…</div>
    <EmptyState v-else-if="!assignments.length || !rows.length" icon="bi-table" :title="t('classes.gradebookEmpty')" :message="t('classes.gradebookEmptyMsg')" />
    <div v-else class="panel gradebook-wrap">
      <table class="gradebook">
        <thead>
          <tr>
            <th class="gb-student">{{ t('classes.student') }}</th>
            <th v-for="a in assignments" :key="a.id">{{ a.title }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="i">
            <td class="gb-student">
              <span class="user-avatar roster-avatar">{{ initials(row.name) }}</span>{{ row.name }}
            </td>
            <td v-for="a in assignments" :key="a.id" class="gb-cell">{{ cell(row, a) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
