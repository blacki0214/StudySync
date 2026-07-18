<script setup>
/**
 * ClassAnalyticsTab — a teacher's at-a-glance insight into a class (Phase 5):
 * students, quizzes + average score, slide decks and discussion activity.
 * Computed from the existing class-scoped services.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { classQuizService } from '../../services/classQuizService.js'
import { slideService } from '../../services/slideService.js'
import { classActivityService } from '../../services/classActivityService.js'
import StatCard from '../common/StatCard.vue'

const props = defineProps({
  classId: { type: String, required: true },
  roster: { type: Array, default: () => [] }
})
const { t } = useI18n()

const quizCount = ref(0)
const avgScore = ref(null)
const deckCount = ref(0)
const threadCount = ref(0)

onMounted(async () => {
  const [quizzes, decks, threads] = await Promise.all([
    classQuizService.listQuizzes(props.classId),
    slideService.listDecks(props.classId),
    classActivityService.listThreads(props.classId)
  ])
  quizCount.value = quizzes.length
  deckCount.value = decks.length
  threadCount.value = threads.length

  // Average score across all results of all quizzes.
  const allResults = (await Promise.all(quizzes.map((q) => classQuizService.listResults(q.id)))).flat()
  if (allResults.length) {
    const mean = allResults.reduce((s, r) => s + (r.total ? r.score / r.total : 0), 0) / allResults.length
    avgScore.value = Math.round(mean * 100)
  }
})

const stats = computed(() => [
  { label: t('analytics.students'), value: props.roster.length, icon: 'bi-mortarboard', grad: 'grad-blue' },
  { label: t('analytics.quizzes'), value: quizCount.value, icon: 'bi-patch-question', grad: 'grad-orange' },
  { label: t('analytics.avgScore'), value: avgScore.value === null ? '—' : avgScore.value + '%', icon: 'bi-graph-up', grad: 'grad-green' },
  { label: t('analytics.decks'), value: deckCount.value, icon: 'bi-easel', grad: 'grad-fuchsia' },
  { label: t('analytics.discussions'), value: threadCount.value, icon: 'bi-chat-square-text', grad: 'grad-blue' }
])
</script>

<template>
  <div class="row g-3">
    <div v-for="s in stats" :key="s.label" class="col-6 col-md-4 col-xl-3"><StatCard v-bind="s" /></div>
  </div>
</template>
