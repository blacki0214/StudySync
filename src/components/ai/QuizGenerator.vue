<script setup>
/**
 * QuizGenerator — interactive multiple-choice quiz built by the manual quiz
 * generator (distractors from other answers/keywords, manually shuffled).
 * Tracks the user's selections and scores them at the end.
 */
import { ref, computed, watch } from 'vue'
import { generateQuiz } from '../../utils/quizGenerator.js'

const props = defineProps({
  content: { type: String, default: '' }
})

const questions = ref([])
const current = ref(0)
const answers = ref([]) // selected option index per question
const finished = ref(false)

function build() {
  questions.value = generateQuiz(props.content, { maxQuestions: 8 })
  current.value = 0
  answers.value = new Array(questions.value.length).fill(null)
  finished.value = false
}

function select(optionIndex) {
  if (finished.value) return
  answers.value[current.value] = optionIndex
}

function next() {
  if (current.value < questions.value.length - 1) current.value++
  else finished.value = true
}
function prev() {
  if (current.value > 0) current.value--
}

const score = computed(
  () => questions.value.filter((q, i) => answers.value[i] === q.correctAnswer).length
)
const percent = computed(() =>
  questions.value.length ? Math.round((score.value / questions.value.length) * 100) : 0
)

// Decide the CSS class for an option once the quiz is finished (reveal mode).
function optionClass(qi, oi) {
  if (!finished.value) return answers.value[qi] === oi ? 'selected' : ''
  const q = questions.value[qi]
  if (oi === q.correctAnswer) return 'correct'
  if (answers.value[qi] === oi) return 'incorrect'
  return ''
}

watch(() => props.content, build, { immediate: true })
</script>

<template>
  <div>
    <div class="generator-toolbar">
      <h2 class="section-title mb-0"><i class="bi bi-patch-question"></i>Quiz</h2>
      <span v-if="questions.length" class="quiz-progress ms-auto">
        Question {{ current + 1 }} / {{ questions.length }}
      </span>
    </div>

    <div v-if="!questions.length" class="empty-state">
      <div class="empty-icon"><i class="bi bi-patch-question"></i></div>
      <p class="text-muted-sm">Not enough definition sentences to build a quiz. Add more detailed
        notes and try again.</p>
    </div>

    <!-- Result screen -->
    <div v-else-if="finished" class="quiz-card quiz-result">
      <div class="score-circle">{{ percent }}%</div>
      <h4>You scored {{ score }} / {{ questions.length }}</h4>
      <p class="text-muted-sm">Review the highlighted answers below, or try again.</p>
      <button class="btn btn-brand" @click="build"><i class="bi bi-arrow-repeat me-1"></i>Retake quiz</button>

      <div class="text-start mt-4">
        <div v-for="(q, qi) in questions" :key="qi" class="mb-3">
          <div class="quiz-question">{{ qi + 1 }}. {{ q.question }}</div>
          <div
            v-for="(opt, oi) in q.options"
            :key="oi"
            class="quiz-option"
            :class="optionClass(qi, oi)"
          >
            <span class="opt-key">{{ String.fromCharCode(65 + oi) }}</span>{{ opt }}
          </div>
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
        :class="optionClass(current, oi)"
        @click="select(oi)"
      >
        <span class="opt-key">{{ String.fromCharCode(65 + oi) }}</span>{{ opt }}
      </div>

      <div class="d-flex justify-content-between mt-4">
        <button class="btn btn-soft" :disabled="current === 0" @click="prev">
          <i class="bi bi-arrow-left me-1"></i>Back
        </button>
        <button class="btn btn-brand" :disabled="answers[current] === null" @click="next">
          {{ current === questions.length - 1 ? 'Finish' : 'Next' }}
          <i class="bi bi-arrow-right ms-1"></i>
        </button>
      </div>
    </div>
  </div>
</template>
