<script setup>
/**
 * SubmissionsPanel — teacher view of all submissions for one assignment. Quiz
 * submissions are auto-scored; free-text submissions can be graded here.
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { assignmentService } from '../../services/assignmentService.js'
import { timeAgo } from '../../utils/formatDate.js'

const props = defineProps({ assignment: { type: Object, required: true } })
const emit = defineEmits(['close'])
const { t } = useI18n()

const subs = ref([])
const loading = ref(true)

onMounted(async () => {
  subs.value = await assignmentService.listSubmissions(props.assignment.id)
  loading.value = false
})

async function grade(s) {
  const val = Number(s._grade)
  if (Number.isNaN(val)) return
  await assignmentService.grade(s.id, val, 100)
  s.score = val; s.total = 100; s.graded = true
}
function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
  <div class="modal d-block" tabindex="-1" style="background: rgba(15,23,42,.5)">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ t('classes.submissionsFor', { title: assignment.title }) }}</h5>
          <button class="btn-close" @click="emit('close')"></button>
        </div>
        <div class="modal-body">
          <div v-if="loading" class="text-muted-sm">…</div>
          <p v-else-if="!subs.length" class="doc-empty">{{ t('classes.noSubmissions') }}</p>

          <div v-for="s in subs" :key="s.id" class="sub-row">
            <div class="sub-head">
              <span class="user-avatar roster-avatar">{{ initials(s.user?.full_name) }}</span>
              <span class="roster-name">{{ s.user?.full_name || t('classes.student') }}</span>
              <span class="announce-ago">· {{ timeAgo(s.created_at) }}</span>
              <span class="roster-spacer"></span>
              <span v-if="s.total != null" class="badge-soft">{{ s.score }} / {{ s.total }}</span>
              <span v-else class="badge-outline">{{ t('classes.ungraded') }}</span>
            </div>
            <div v-if="s.content" class="sub-content">{{ s.content }}</div>

            <!-- Grade free-text submissions -->
            <div v-if="assignment.type === 'text'" class="sub-grade">
              <input v-model="s._grade" type="number" min="0" max="100" class="form-control sub-grade-input" :placeholder="t('classes.scorePlaceholder')" />
              <button class="btn btn-outline-soft btn-sm" @click="grade(s)">{{ t('classes.grade') }}</button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-soft" @click="emit('close')">{{ t('common.cancel') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
