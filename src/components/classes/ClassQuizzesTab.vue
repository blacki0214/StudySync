<script setup>
/**
 * ClassQuizzesTab — teacher-authored multiple-choice quizzes for a class
 * (Phase 4). Teacher/TA builds a quiz; students take it and get a score that's
 * saved (and surfaced to the gradebook). Three modes: list · build · take.
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/authStore.js'
import { useDialogStore } from '../../stores/dialogStore.js'
import { classQuizService } from '../../services/classQuizService.js'
import EmptyState from '../common/EmptyState.vue'

const props = defineProps({
  classId: { type: String, required: true },
  canManage: { type: Boolean, default: false }
})
const { t } = useI18n()
const auth = useAuthStore()
const dialog = useDialogStore()

const mode = ref('list') // list | build | take
const quizzes = ref([])
const myResults = ref({}) // quizId -> result

onMounted(load)
async function load() {
  quizzes.value = await classQuizService.listQuizzes(props.classId)
  const entries = await Promise.all(
    quizzes.value.map(async (q) => [q.id, await classQuizService.myResult(q.id, auth.user?.id)])
  )
  myResults.value = Object.fromEntries(entries)
}

// --- Build ---------------------------------------------------------------
const blankQuestion = () => ({ q: '', options: ['', '', '', ''], answer: 0 })
const builder = ref({ title: '', questions: [blankQuestion()] })
function startBuild() { builder.value = { title: '', questions: [blankQuestion()] }; mode.value = 'build' }
function addQuestion() { builder.value.questions.push(blankQuestion()) }
function removeQuestion(i) { if (builder.value.questions.length > 1) builder.value.questions.splice(i, 1) }
async function saveQuiz() {
  const title = builder.value.title.trim()
  const questions = builder.value.questions
    .filter((q) => q.q.trim() && q.options.some((o) => o.trim()))
    .map((q) => ({ q: q.q.trim(), options: q.options.map((o) => o.trim()), answer: q.answer }))
  if (!title || !questions.length) { dialog.toast(t('quizzes.needContent'), 'warning'); return }
  await classQuizService.createQuiz({ classId: props.classId, title, questions, ownerId: auth.user?.id })
  mode.value = 'list'
  await load()
}
async function removeQuiz(quiz) {
  const ok = await dialog.confirm({ message: t('quizzes.deleteConfirm', { name: quiz.title }), danger: true })
  if (!ok) return
  await classQuizService.deleteQuiz(quiz.id)
  quizzes.value = quizzes.value.filter((q) => q.id !== quiz.id)
}

// --- Take ----------------------------------------------------------------
const taking = ref(null)
const answers = ref([])
const takeScore = ref(null)
function startTake(quiz) {
  taking.value = quiz
  answers.value = quiz.questions.map(() => -1)
  takeScore.value = null
  mode.value = 'take'
}
async function submitTake() {
  const total = taking.value.questions.length
  const score = taking.value.questions.reduce((n, q, i) => n + (answers.value[i] === q.answer ? 1 : 0), 0)
  takeScore.value = { score, total }
  await classQuizService.saveResult({ quizId: taking.value.id, userId: auth.user?.id, userName: auth.user?.full_name, score, total })
}
async function finishTake() {
  mode.value = 'list'
  taking.value = null
  await load()
}
</script>

<template>
  <div>
    <!-- LIST -->
    <template v-if="mode === 'list'">
      <div v-if="canManage" class="tab-toolbar">
        <button class="btn btn-brand btn-sm" @click="startBuild"><i class="bi bi-plus-lg"></i>{{ t('quizzes.newQuiz') }}</button>
      </div>
      <EmptyState v-if="!quizzes.length" icon="bi-patch-question" :title="t('quizzes.none')" :message="t('quizzes.noneMsg')" />
      <div v-else class="panel roster">
        <div v-for="q in quizzes" :key="q.id" class="roster-row quiz-row">
          <span class="icon-tile grad-orange quiz-ic"><i class="bi bi-patch-question"></i></span>
          <div class="quiz-meta">
            <div class="roster-name">{{ q.title }}</div>
            <div class="quiz-sub">{{ t('quizzes.questionCount', { n: q.questions.length }) }}</div>
          </div>
          <span class="roster-spacer"></span>
          <span v-if="myResults[q.id]" class="badge-soft quiz-score">{{ myResults[q.id].score }}/{{ myResults[q.id].total }}</span>
          <button class="btn btn-outline-soft btn-sm" @click="startTake(q)">
            <i class="bi bi-play-fill"></i>{{ myResults[q.id] ? t('quizzes.retake') : t('quizzes.take') }}
          </button>
          <button v-if="canManage" class="quiz-del" :title="t('quizzes.delete')" @click="removeQuiz(q)"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </template>

    <!-- BUILD -->
    <div v-else-if="mode === 'build'" class="quiz-build">
      <div class="quiz-build-head">
        <input v-model="builder.title" class="form-control" :placeholder="t('quizzes.titlePlaceholder')" />
      </div>
      <div v-for="(q, qi) in builder.questions" :key="qi" class="quiz-q-card">
        <div class="quiz-q-top">
          <span class="quiz-q-num">{{ qi + 1 }}</span>
          <input v-model="q.q" class="form-control" :placeholder="t('quizzes.questionPlaceholder')" />
          <button v-if="builder.questions.length > 1" class="quiz-del" @click="removeQuestion(qi)"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="quiz-opts">
          <label v-for="(opt, oi) in q.options" :key="oi" class="quiz-opt-edit" :class="{ correct: q.answer === oi }">
            <input type="radio" :name="'q'+qi" :checked="q.answer === oi" @change="q.answer = oi" />
            <input v-model="q.options[oi]" class="form-control" :placeholder="t('quizzes.optionPlaceholder', { n: oi + 1 })" />
          </label>
        </div>
      </div>
      <div class="quiz-build-actions">
        <button class="btn btn-outline-soft btn-sm" @click="addQuestion"><i class="bi bi-plus-lg"></i>{{ t('quizzes.addQuestion') }}</button>
        <span class="roster-spacer"></span>
        <button class="btn btn-soft" @click="mode = 'list'">{{ t('common.cancel') }}</button>
        <button class="btn btn-brand" @click="saveQuiz"><i class="bi bi-check-lg"></i>{{ t('quizzes.save') }}</button>
      </div>
    </div>

    <!-- TAKE -->
    <div v-else-if="mode === 'take' && taking" class="quiz-take">
      <div class="quiz-take-head">
        <h3>{{ taking.title }}</h3>
        <button class="btn btn-soft btn-sm" @click="finishTake">{{ t('common.close') }}</button>
      </div>

      <template v-if="!takeScore">
        <div v-for="(q, qi) in taking.questions" :key="qi" class="quiz-q-card">
          <div class="quiz-take-q"><span class="quiz-q-num">{{ qi + 1 }}</span>{{ q.q }}</div>
          <label v-for="(opt, oi) in q.options" :key="oi" class="quiz-opt" :class="{ picked: answers[qi] === oi }">
            <input type="radio" :name="'take'+qi" :checked="answers[qi] === oi" @change="answers[qi] = oi" />
            <span>{{ opt }}</span>
          </label>
        </div>
        <button class="btn btn-brand" @click="submitTake"><i class="bi bi-check2-circle"></i>{{ t('quizzes.submit') }}</button>
      </template>

      <div v-else class="quiz-result">
        <div class="quiz-result-score">{{ takeScore.score }} / {{ takeScore.total }}</div>
        <p>{{ t('quizzes.resultMsg', { pct: Math.round(takeScore.score / takeScore.total * 100) }) }}</p>
        <button class="btn btn-brand" @click="finishTake">{{ t('quizzes.done') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quiz-row { align-items: center; gap: var(--space-3); }
.quiz-ic { width: 34px; height: 34px; border-radius: 9px; }
.quiz-meta { min-width: 0; }
.quiz-sub { font-size: 0.78rem; color: var(--c-text-faint); }
.quiz-score { font-weight: 700; }
.quiz-del { border: none; background: none; color: var(--c-text-faint); cursor: pointer; padding: 0.3rem; border-radius: 6px; }
.quiz-del:hover { color: var(--c-danger); background: var(--c-surface-2); }

.quiz-build-head { margin-bottom: var(--space-3); }
.quiz-q-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius); padding: var(--space-4); margin-bottom: var(--space-3); }
.quiz-q-top { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); }
.quiz-q-num { width: 26px; height: 26px; flex-shrink: 0; border-radius: 50%; background: var(--c-primary-light); color: var(--c-primary-dark); display: grid; place-items: center; font-weight: 700; font-size: 0.8rem; }
.quiz-opts { display: flex; flex-direction: column; gap: var(--space-2); }
.quiz-opt-edit { display: flex; align-items: center; gap: var(--space-2); }
.quiz-opt-edit.correct .form-control { border-color: var(--c-green); }
.quiz-build-actions { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-3); }

.quiz-take-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); }
.quiz-take-q { display: flex; align-items: center; gap: var(--space-2); font-weight: 700; margin-bottom: var(--space-3); }
.quiz-opt { display: flex; align-items: center; gap: var(--space-2); padding: 0.6rem 0.8rem; border: 1px solid var(--c-border); border-radius: var(--radius-sm); margin-bottom: var(--space-2); cursor: pointer; }
.quiz-opt.picked { border-color: var(--c-primary); background: var(--c-primary-light); }
.quiz-result { text-align: center; padding: var(--space-6) var(--space-4); }
.quiz-result-score { font-size: 2.6rem; font-weight: 800; color: var(--c-primary); }
</style>
