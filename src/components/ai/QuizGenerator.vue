<script setup>
/**
 * QuizGenerator — interactive multiple-choice quiz (AI-backed via aiService,
 * manual fallback). Answering a question immediately reveals whether it was
 * right or wrong and shows an explanation; the choice then locks. A score +
 * full review (with explanations) is shown at the end.
 */
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { generateQuiz } from '../../services/aiService.js'
import { cachedGenerate } from '../../services/studySetCacheService.js'
import { useAuthStore } from '../../stores/authStore.js'

const { t } = useI18n()
const auth = useAuthStore()
const props = defineProps({
  content: { type: String, default: '' },
  // Stable id for the quiz's source (e.g. `note:<id>` / `subject:<id>`). When
  // set, the generated quiz is cached per user and reused instead of costing an
  // AI call on every visit. Empty string disables caching.
  cacheKey: { type: String, default: '' }
})

const questions = ref([])
const current = ref(0)
const answers = ref([]) // selected option index per question
const finished = ref(false)
const building = ref(false)

// Reset the attempt state (score/selections) WITHOUT re-generating — used by
// "Retake" so the same questions can be re-attempted for free.
function resetAttempt() {
  current.value = 0
  answers.value = new Array(questions.value.length).fill(null)
  finished.value = false
}

// Load the quiz. Reuses the per-user cached set when available; pass force=true
// (the "New questions" button) to spend an AI call and overwrite the cache.
async function build(force = false) {
  building.value = true
  try {
    const { data } = await cachedGenerate({
      userId: auth.user?.id,
      kind: 'quiz',
      sourceKey: props.cacheKey,
      content: props.content,
      options: { max: 8 },
      generator: (c, o) => generateQuiz(c, o),
      force
    })
    questions.value = data || []
  } catch {
    questions.value = []
  } finally {
    building.value = false
  }
  resetAttempt()
}

function select(optionIndex) {
  if (finished.value) return
  if (answers.value[current.value] !== null) return // locked after first answer
  answers.value[current.value] = optionIndex
}

function next() {
  if (current.value < questions.value.length - 1) current.value++
  else finished.value = true
}
function prev() {
  if (current.value > 0) current.value--
}

// Has the current question been answered? (drives the reveal + Next button)
const answeredCurrent = computed(() => answers.value[current.value] !== null)
const isCorrectCurrent = computed(
  () => answeredCurrent.value && answers.value[current.value] === questions.value[current.value]?.correctAnswer
)

const score = computed(
  () => questions.value.filter((q, i) => answers.value[i] === q.correctAnswer).length
)
const percent = computed(() =>
  questions.value.length ? Math.round((score.value / questions.value.length) * 100) : 0
)

// Reveal an option's correctness as soon as that question is answered.
function optionClass(qi, oi) {
  const answered = finished.value || answers.value[qi] !== null
  if (!answered) return ''
  const q = questions.value[qi]
  if (oi === q.correctAnswer) return 'correct'
  if (answers.value[qi] === oi) return 'incorrect'
  return ''
}

// Re-load (from cache when possible) whenever the source content changes,
// including on first mount. Never force here — that would spend a credit on
// every navigation, which is exactly what the cache avoids.
watch(() => props.content, () => build(), { immediate: true })
</script>

<template>
  <div>
    <div class="quiz-head">
      <h2 class="section-title section-title-flush"><i class="bi bi-patch-question"></i>{{ t('quiz.title') }}</h2>
      <span v-if="questions.length" class="badge-soft">
        {{ t('quiz.questionOf', { current: current + 1, total: questions.length }) }}
      </span>
    </div>

    <div v-if="building" class="empty-state">
      <div class="empty-icon"><i class="bi bi-arrow-repeat spin"></i></div>
      <p class="empty-text">{{ t('quiz.generating') }}</p>
    </div>

    <div v-else-if="!questions.length" class="empty-state">
      <div class="empty-icon"><i class="bi bi-patch-question"></i></div>
      <p class="empty-text">{{ t('quiz.empty') }}</p>
    </div>

    <!-- Result screen -->
    <div v-else-if="finished" class="quiz-card quiz-result">
      <div class="score-circle">{{ percent }}%</div>
      <h4>{{ t('quiz.scored', { score, total: questions.length }) }}</h4>
      <p class="quiz-result-sub">{{ t('quiz.reviewHint') }}</p>
      <div class="quiz-result-actions">
        <button class="btn btn-brand" @click="resetAttempt"><i class="bi bi-arrow-repeat"></i>{{ t('quiz.retake') }}</button>
        <button class="btn btn-soft" :disabled="building" @click="build(true)"><i class="bi bi-stars"></i>{{ t('quiz.newQuestions') }}</button>
      </div>

      <div class="quiz-review">
        <div v-for="(q, qi) in questions" :key="qi" class="quiz-review-item">
          <div class="quiz-question">{{ qi + 1 }}. {{ q.question }}</div>
          <div
            v-for="(opt, oi) in q.options"
            :key="oi"
            class="quiz-option"
            :class="optionClass(qi, oi)"
          >
            <span class="opt-key">{{ String.fromCharCode(65 + oi) }}</span>{{ opt }}
          </div>
          <p v-if="q.explanation" class="quiz-review-why"><i class="bi bi-info-circle"></i>{{ q.explanation }}</p>
        </div>
      </div>
    </div>

    <!-- Active question -->
    <div v-else class="quiz-card">
      <div class="quiz-question">{{ questions[current].question }}</div>
      <div
        v-for="(opt, oi) in questions[current].options"
        :key="oi"
        class="quiz-option"
        :class="[optionClass(current, oi), { 'is-locked': answeredCurrent }]"
        @click="select(oi)"
      >
        <span class="opt-key">{{ String.fromCharCode(65 + oi) }}</span>{{ opt }}
      </div>

      <!-- Immediate feedback + explanation -->
      <div v-if="answeredCurrent" class="quiz-feedback" :class="isCorrectCurrent ? 'ok' : 'bad'">
        <div class="qf-head">
          <i class="bi" :class="isCorrectCurrent ? 'bi-check-circle-fill' : 'bi-x-circle-fill'"></i>
          {{ isCorrectCurrent ? t('quiz.correct') : t('quiz.incorrect') }}
        </div>
        <p v-if="questions[current].explanation" class="qf-text">{{ questions[current].explanation }}</p>
        <p v-else class="qf-text">{{ t('quiz.correctAnswerIs', { answer: questions[current].options[questions[current].correctAnswer] }) }}</p>
      </div>

      <div class="quiz-nav">
        <button class="btn btn-soft" :disabled="current === 0" @click="prev">
          <i class="bi bi-arrow-left"></i>{{ t('quiz.back') }}
        </button>
        <button class="btn btn-brand" :disabled="answers[current] === null" @click="next">
          {{ current === questions.length - 1 ? t('quiz.finish') : t('quiz.next') }}
          <i class="bi bi-arrow-right"></i>
        </button>
      </div>
    </div>
  </div>
</template>
