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

const { t } = useI18n()
const props = defineProps({
  content: { type: String, default: '' }
})

const questions = ref([])
const current = ref(0)
const answers = ref([]) // selected option index per question
const finished = ref(false)
const building = ref(false)

async function build() {
  building.value = true
  try {
    questions.value = await generateQuiz(props.content, { max: 8 })
  } catch {
    questions.value = []
  } finally {
    building.value = false
  }
  current.value = 0
  answers.value = new Array(questions.value.length).fill(null)
  finished.value = false
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

watch(() => props.content, build, { immediate: true })
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
      <button class="btn btn-brand" @click="build"><i class="bi bi-arrow-repeat"></i>{{ t('quiz.retake') }}</button>

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
