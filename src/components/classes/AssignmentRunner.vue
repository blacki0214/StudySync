<script setup>
/**
 * AssignmentRunner — a student does an assignment. Free-text assignments show a
 * textarea; quiz assignments generate MCQs from the linked document, auto-grade
 * on submit, and record a quiz attempt.
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { assignmentService } from '../../services/assignmentService.js'
import { documentService } from '../../services/documentService.js'
import { generateQuiz } from '../../utils/quizGenerator.js'
import { useAuthStore } from '../../stores/authStore.js'

const props = defineProps({ assignment: { type: Object, required: true } })
const emit = defineEmits(['close', 'submitted'])
const { t } = useI18n()
const auth = useAuthStore()

const loading = ref(true)
const content = ref('')
const questions = ref([])
const answers = ref([])     // selected option index per question
const result = ref(null)    // { score, total }
const submitting = ref(false)
const error = ref('')

onMounted(async () => {
  const existing = await assignmentService.getMySubmission(props.assignment.id, auth.user?.id)
  if (existing) {
    content.value = existing.content || ''
    if (existing.graded && existing.total != null) result.value = { score: existing.score, total: existing.total }
  }
  if (props.assignment.type === 'quiz' && !result.value) {
    const doc = props.assignment.source_document_id
      ? await documentService.getDocument(props.assignment.source_document_id)
      : null
    questions.value = doc ? generateQuiz(doc.extracted_text || '', { maxQuestions: 8 }) : []
    answers.value = questions.value.map(() => -1)
    if (!questions.value.length) error.value = t('classes.quizUnavailable')
  }
  loading.value = false
})

async function submitText() {
  if (!content.value.trim()) return
  submitting.value = true
  try {
    await assignmentService.submit({ assignmentId: props.assignment.id, userId: auth.user?.id, userName: auth.user?.full_name, content: content.value.trim(), graded: false })
    emit('submitted')
    emit('close')
  } finally { submitting.value = false }
}

async function submitQuiz() {
  submitting.value = true
  try {
    let score = 0
    questions.value.forEach((q, i) => { if (answers.value[i] === q.correctAnswer) score++ })
    const total = questions.value.length
    await assignmentService.submit({
      assignmentId: props.assignment.id, userId: auth.user?.id, userName: auth.user?.full_name,
      answers: answers.value, score, total, graded: true
    })
    await assignmentService.recordQuizAttempt({ userId: auth.user?.id, classId: props.assignment.class_id, documentId: props.assignment.source_document_id, score, total })
    result.value = { score, total }
    emit('submitted')
  } finally { submitting.value = false }
}
</script>

<template>
  <div class="modal d-block" tabindex="-1" style="background: rgba(15,23,42,.5)">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ assignment.title }}</h5>
          <button class="btn-close" @click="emit('close')"></button>
        </div>
        <div class="modal-body">
          <p v-if="assignment.instructions" class="assign-instructions">{{ assignment.instructions }}</p>

          <div v-if="loading" class="text-muted-sm">…</div>

          <!-- Already graded quiz -->
          <div v-else-if="result" class="quiz-result">
            <div class="qr-score">{{ result.score }} / {{ result.total }}</div>
            <p class="text-muted-sm">{{ t('classes.quizDone') }}</p>
          </div>

          <!-- Free-text assignment -->
          <template v-else-if="assignment.type === 'text'">
            <textarea v-model="content" class="form-control" rows="8" :placeholder="t('classes.answerPlaceholder')"></textarea>
          </template>

          <!-- Quiz assignment -->
          <template v-else>
            <p v-if="error" class="form-error"><i class="bi bi-exclamation-circle"></i>{{ error }}</p>
            <div v-for="(q, qi) in questions" :key="qi" class="quiz-q">
              <div class="quiz-q-text">{{ qi + 1 }}. {{ q.question }}</div>
              <label v-for="(opt, oi) in q.options" :key="oi" class="quiz-opt" :class="{ on: answers[qi] === oi }">
                <input type="radio" :name="'q' + qi" :value="oi" v-model="answers[qi]" />
                <span>{{ opt }}</span>
              </label>
            </div>
          </template>
        </div>
        <div class="modal-footer">
          <button class="btn btn-soft" @click="emit('close')">{{ t('common.cancel') }}</button>
          <button v-if="!result && assignment.type === 'text'" class="btn btn-brand" :disabled="submitting || !content.trim()" @click="submitText">
            <span v-if="submitting" class="spinner-border spinner-border-sm"></span>{{ t('classes.submit') }}
          </button>
          <button v-else-if="!result && assignment.type === 'quiz'" class="btn btn-brand" :disabled="submitting || !questions.length" @click="submitQuiz">
            <span v-if="submitting" class="spinner-border spinner-border-sm"></span>{{ t('classes.submitQuiz') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
