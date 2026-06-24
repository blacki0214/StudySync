<script setup>
/**
 * ClassAssignmentsTab — teachers create free-text or auto-graded quiz
 * assignments (a quiz is generated from a class document); students open and
 * submit them; teachers review submissions.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogStore } from '../../stores/dialogStore.js'
import { assignmentService } from '../../services/assignmentService.js'
import { documentService } from '../../services/documentService.js'
import { useAuthStore } from '../../stores/authStore.js'
import { timeAgo } from '../../utils/formatDate.js'
import AppSelect from '../common/AppSelect.vue'
import EmptyState from '../common/EmptyState.vue'
import AssignmentRunner from './AssignmentRunner.vue'
import SubmissionsPanel from './SubmissionsPanel.vue'

const props = defineProps({ classId: { type: String, required: true }, isOwner: { type: Boolean, default: false } })
const { t } = useI18n()
const dialog = useDialogStore()
const auth = useAuthStore()

const assignments = ref([])
const docs = ref([])
const showForm = ref(false)
const creating = ref(false)
const form = ref({ title: '', instructions: '', type: 'text', sourceDocumentId: '', dueAt: '' })
const runner = ref(null)   // assignment a student is doing
const subsFor = ref(null)  // assignment whose submissions a teacher is viewing

const typeOptions = computed(() => [
  { value: 'text', label: t('classes.typeText') },
  { value: 'quiz', label: t('classes.typeQuiz') }
])
const docOptions = computed(() => docs.value.map((d) => ({ value: d.id, label: d.title })))

onMounted(async () => {
  assignments.value = await assignmentService.listByClass(props.classId)
  if (props.isOwner) docs.value = await documentService.listByClass(props.classId)
})

function openForm() {
  form.value = { title: '', instructions: '', type: 'text', sourceDocumentId: docs.value[0]?.id || '', dueAt: '' }
  showForm.value = true
}
async function create() {
  if (!form.value.title.trim()) return
  if (form.value.type === 'quiz' && !form.value.sourceDocumentId) return
  creating.value = true
  try {
    const row = await assignmentService.create({
      classId: props.classId, authorId: auth.user?.id,
      title: form.value.title, instructions: form.value.instructions, type: form.value.type,
      sourceDocumentId: form.value.type === 'quiz' ? form.value.sourceDocumentId : null,
      dueAt: form.value.dueAt || null
    })
    assignments.value.unshift(row)
    showForm.value = false
  } finally { creating.value = false }
}
async function remove(a) {
  if (!(await dialog.confirm({ message: t('classes.confirmDeleteAssignment'), danger: true, confirmText: t('common.delete') }))) return
  await assignmentService.remove(a.id)
  assignments.value = assignments.value.filter((x) => x.id !== a.id)
}
</script>

<template>
  <div>
    <div v-if="isOwner" class="tab-toolbar">
      <button class="btn btn-brand btn-sm" @click="openForm"><i class="bi bi-plus-lg"></i>{{ t('classes.newAssignment') }}</button>
    </div>

    <EmptyState v-if="!assignments.length" icon="bi-card-checklist" :title="t('classes.noAssignments')" />

    <div v-for="a in assignments" :key="a.id" class="assign-card">
      <div class="assign-top">
        <span class="badge-soft"><i class="bi" :class="a.type === 'quiz' ? 'bi-patch-question' : 'bi-pencil'"></i> {{ a.type === 'quiz' ? t('classes.typeQuiz') : t('classes.typeText') }}</span>
        <span v-if="a.due_at" class="announce-ago">{{ t('classes.due', { when: timeAgo(a.due_at) }) }}</span>
      </div>
      <div class="assign-title">{{ a.title }}</div>
      <div v-if="a.instructions" class="assign-desc">{{ a.instructions }}</div>
      <div class="assign-foot">
        <button v-if="!isOwner" class="btn btn-brand btn-sm" @click="runner = a"><i class="bi bi-pencil-square"></i>{{ t('classes.openAssignment') }}</button>
        <template v-else>
          <button class="btn btn-outline-soft btn-sm" @click="subsFor = a"><i class="bi bi-inbox"></i>{{ t('classes.viewSubmissions') }}</button>
          <button class="btn btn-outline-soft btn-sm text-danger" @click="remove(a)"><i class="bi bi-trash"></i></button>
        </template>
      </div>
    </div>

    <!-- Create assignment modal -->
    <div v-if="showForm" class="modal d-block" tabindex="-1" style="background: rgba(15,23,42,.5)">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ t('classes.newAssignment') }}</h5>
            <button class="btn-close" @click="showForm = false"></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>{{ t('classes.assignTitle') }}</label>
              <input v-model="form.title" class="form-control" :placeholder="t('classes.assignTitlePlaceholder')" />
            </div>
            <div class="form-group">
              <label>{{ t('classes.assignType') }}</label>
              <AppSelect v-model="form.type" :options="typeOptions" :aria-label="t('classes.assignType')" />
            </div>
            <div v-if="form.type === 'quiz'" class="form-group">
              <label>{{ t('classes.assignSource') }}</label>
              <AppSelect v-if="docOptions.length" v-model="form.sourceDocumentId" :options="docOptions" :aria-label="t('classes.assignSource')" />
              <p v-else class="form-error"><i class="bi bi-exclamation-circle"></i>{{ t('classes.needDocForQuiz') }}</p>
            </div>
            <div class="form-group">
              <label>{{ t('classes.instructions') }}</label>
              <textarea v-model="form.instructions" class="form-control" rows="3" :placeholder="t('classes.instructionsPlaceholder')"></textarea>
            </div>
            <div class="form-group">
              <label>{{ t('classes.dueDate') }}</label>
              <input v-model="form.dueAt" type="date" class="form-control" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-soft" @click="showForm = false">{{ t('common.cancel') }}</button>
            <button class="btn btn-brand" :disabled="creating || !form.title.trim() || (form.type === 'quiz' && !form.sourceDocumentId)" @click="create">
              <span v-if="creating" class="spinner-border spinner-border-sm"></span>{{ t('classes.create') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <AssignmentRunner v-if="runner" :assignment="runner" @close="runner = null" @submitted="() => {}" />
    <SubmissionsPanel v-if="subsFor" :assignment="subsFor" @close="subsFor = null" />
  </div>
</template>
