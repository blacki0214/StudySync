<script setup>
/**
 * FlashcardsView — the "manual AI" study tools hub. Pick a note (or arrive with
 * /flashcards/:noteId), then switch between Flashcards, Quiz, Summary and
 * Difficulty — all generated locally by the rule-based utilities. No AI API.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useNoteStore } from '../stores/noteStore.js'
import { useSubjectStore } from '../stores/subjectStore.js'
import { analyzeDifficulty } from '../utils/difficultyAnalyzer.js'
import FlashcardGenerator from '../components/ai/FlashcardGenerator.vue'
import QuizGenerator from '../components/ai/QuizGenerator.vue'
import StudySummary from '../components/ai/StudySummary.vue'
import KeywordExtractor from '../components/ai/KeywordExtractor.vue'
import DifficultyHeatmap from '../components/study/DifficultyHeatmap.vue'
import EmptyState from '../components/common/EmptyState.vue'

const route = useRoute()
const noteStore = useNoteStore()
const subjectStore = useSubjectStore()

const selectedId = ref(route.params.noteId || '')
const tab = ref('flashcards')

onMounted(async () => {
  await Promise.all([noteStore.fetchNotes(), subjectStore.fetchSubjects()])
  if (!selectedId.value && noteStore.notes.length) selectedId.value = noteStore.notes[0].id
})

watch(() => route.params.noteId, (id) => {
  if (id) selectedId.value = id
})

const selectedNote = computed(() => noteStore.notes.find((n) => n.id === selectedId.value) || null)
const content = computed(() => selectedNote.value?.content || '')
const difficulty = computed(() => (content.value ? analyzeDifficulty(content.value) : null))

const tabs = [
  { key: 'flashcards', label: 'Flashcards', icon: 'bi-card-text' },
  { key: 'quiz', label: 'Quiz', icon: 'bi-patch-question' },
  { key: 'summary', label: 'Summary & terms', icon: 'bi-card-list' },
  { key: 'difficulty', label: 'Difficulty', icon: 'bi-bar-chart-steps' }
]
</script>

<template>
  <div>
    <div class="page-header">
      <h1>Study tools</h1>
      <p>Auto-generated flashcards, quizzes, summaries and difficulty analysis — all built with
        rule-based JavaScript, no external AI.</p>
    </div>

    <!-- Note picker -->
    <div class="d-flex align-items-center gap-3 mb-4 flex-wrap">
      <label class="fw-semibold mb-0">Note:</label>
      <select v-model="selectedId" class="form-select" style="max-width: 420px">
        <option v-for="n in noteStore.notes" :key="n.id" :value="n.id">{{ n.title }}</option>
      </select>
      <span v-if="difficulty" class="difficulty-pill" :class="`difficulty-${difficulty.level}`">
        {{ difficulty.level }}
      </span>
    </div>

    <EmptyState
      v-if="!selectedNote"
      icon="bi-lightning-charge"
      title="No note selected"
      message="Create or pick a note to generate study tools."
    />

    <template v-else>
      <!-- Tabs -->
      <ul class="nav nav-pills mb-4">
        <li v-for="t in tabs" :key="t.key" class="nav-item">
          <button
            class="nav-link"
            :class="{ active: tab === t.key }"
            @click="tab = t.key"
          >
            <i class="bi me-1" :class="t.icon"></i>{{ t.label }}
          </button>
        </li>
      </ul>

      <FlashcardGenerator v-if="tab === 'flashcards'" :content="content" />
      <QuizGenerator v-else-if="tab === 'quiz'" :content="content" />

      <div v-else-if="tab === 'summary'" class="row g-4">
        <div class="col-12 col-lg-7"><StudySummary :content="content" /></div>
        <div class="col-12 col-lg-5"><KeywordExtractor :content="content" /></div>
      </div>

      <div v-else-if="tab === 'difficulty'" class="row g-4">
        <div class="col-12 col-lg-8">
          <DifficultyHeatmap v-if="difficulty" :analysis="difficulty" />
        </div>
        <div class="col-12 col-lg-4"><KeywordExtractor :content="content" /></div>
      </div>
    </template>
  </div>
</template>
