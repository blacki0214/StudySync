<script setup>
/**
 * FlashcardsView — spaced-repetition study (matches the Figma) with three modes:
 *   • Study mode  — flip through a deck, rate Again/Hard/Easy, see the reviewed chart.
 *   • Quiz mode   — interactive multiple-choice from the MANUAL quiz generator.
 *   • Create cards — "AI generate from note" using the MANUAL flashcard generator,
 *                    plus keyword analysis. No external AI API.
 *
 * Layout uses only Bootstrap's row/col grid; all other styling is semantic
 * classes defined in styles/flashcards.css.
 */
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { sampleDecks, flashcardStats } from '../data/sampleDecks.js'
import { sampleNotes } from '../data/sampleNotes.js'
import { subjectByCode } from '../data/sampleSubjects.js'
import { generateFlashcards } from '../utils/flashcardGenerator.js'
import StatCard from '../components/common/StatCard.vue'
import BarChart from '../components/charts/BarChart.vue'
import QuizGenerator from '../components/ai/QuizGenerator.vue'
import KeywordExtractor from '../components/ai/KeywordExtractor.vue'

const route = useRoute()
const { t } = useI18n()
// If arriving from a note (/flashcards/:noteId), open straight into "create"
// mode pre-loaded with that note.
const fromNote = sampleNotes.find((n) => n.id === route.params.noteId)
const tab = ref(fromNote ? 'create' : 'study')
const stats = computed(() => [
  { label: t('flashcards.cardsMastered'), value: flashcardStats.mastered, icon: 'bi-trophy', grad: 'grad-orange' },
  { label: t('flashcards.dueToday'), value: flashcardStats.dueToday, icon: 'bi-bullseye', grad: 'grad-blue' },
  { label: t('flashcards.streak'), value: flashcardStats.streak + 'd', icon: 'bi-fire', grad: 'grad-fuchsia' },
  { label: t('flashcards.avgRecall'), value: flashcardStats.avgRecall + '%', icon: 'bi-clock', grad: 'grad-green' }
])
const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ---- Study mode ----
const deck = ref(sampleDecks[0])
const idx = ref(0)
const flipped = ref(false)
const card = computed(() => deck.value.cards[idx.value])
const studyProgress = computed(() => ((idx.value + 1) / deck.value.cards.length) * 100)

function rate() {
  flipped.value = false
  idx.value = (idx.value + 1) % deck.value.cards.length
}
function step(d) {
  flipped.value = false
  idx.value = (idx.value + d + deck.value.cards.length) % deck.value.cards.length
}

// ---- Create cards (manual generation from a note) ----
const noteForGen = ref(fromNote || sampleNotes[0])
const generated = computed(() => generateFlashcards(noteForGen.value.content, { maxCards: 12 }))
</script>

<template>
  <div>
    <header class="page-head">
      <div>
        <h1 class="ph-title">{{ t('flashcards.title') }}</h1>
        <p class="ph-sub">{{ t('flashcards.sub', { due: flashcardStats.dueToday, decks: sampleDecks.length }) }}</p>
      </div>
      <div class="action-row">
        <button class="btn btn-outline-soft" @click="tab='create'"><i class="bi bi-stars"></i>{{ t('flashcards.aiGenerate') }}</button>
        <button class="btn btn-brand"><i class="bi bi-plus-lg"></i>{{ t('flashcards.newDeck') }}</button>
      </div>
    </header>

    <!-- Stat cards -->
    <div class="row g-3 row-gap-section">
      <div v-for="s in stats" :key="s.label" class="col-6 col-xl-3"><StatCard v-bind="s" /></div>
    </div>

    <!-- Tabs -->
    <div class="text-tabs">
      <button class="text-tab" :class="{ active: tab==='study' }" @click="tab='study'">{{ t('flashcards.studyMode') }}</button>
      <button class="text-tab" :class="{ active: tab==='quiz' }" @click="tab='quiz'">{{ t('flashcards.quizMode') }}</button>
      <button class="text-tab" :class="{ active: tab==='create' }" @click="tab='create'">{{ t('flashcards.createCards') }}</button>
    </div>

    <!-- STUDY MODE -->
    <div v-if="tab==='study'" class="row g-4">
      <div class="col-12 col-xl-8">
        <div class="study-head">
          <span class="deck-chip">{{ t('flashcards.cardN', { name: deck.name, current: idx + 1, total: deck.cards.length }) }}</span>
          <div class="study-progress"><div class="sp-fill" :style="{ width: studyProgress + '%' }"></div></div>
        </div>

        <div class="flip-card" :class="{ flipped }" @click="flipped = !flipped">
          <div class="flip-inner">
            <div class="flip-face flip-front">
              <div class="ff-label">{{ t('flashcards.question') }}</div>
              <div class="ff-text">{{ card.question }}</div>
              <div class="ff-hint">{{ t('flashcards.clickReveal') }}</div>
            </div>
            <div class="flip-face flip-back">
              <div class="ff-label">{{ t('flashcards.answer') }}</div>
              <div class="ff-text">{{ card.answer }}</div>
            </div>
          </div>
        </div>

        <div class="srs-row">
          <button class="srs-nav" @click="step(-1)"><i class="bi bi-chevron-left"></i></button>
          <button class="srs-btn again" @click="rate"><i class="bi bi-x-lg"></i>{{ t('flashcards.again') }}</button>
          <button class="srs-btn hard" @click="rate">{{ t('flashcards.hard') }}</button>
          <button class="srs-btn easy" @click="rate"><i class="bi bi-check-lg"></i>{{ t('flashcards.easy') }}</button>
          <button class="srs-nav" @click="step(1)"><i class="bi bi-chevron-right"></i></button>
        </div>
      </div>

      <div class="col-12 col-xl-4">
        <div class="panel">
          <div class="reviewed-title">{{ t('flashcards.cardsReviewed') }}</div>
          <div class="reviewed-sub">{{ t('flashcards.last7') }}</div>
          <BarChart :labels="weekLabels" :values="flashcardStats.reviewedLast7" :height="170" />
          <div class="reviewed-stats">
            <div class="reviewed-stat"><span class="rs-key">{{ t('flashcards.today') }}</span><span class="rs-val">{{ t('flashcards.cardsN', { n: flashcardStats.todayCount }) }}</span></div>
            <div class="reviewed-stat"><span class="rs-key">{{ t('flashcards.thisWeek') }}</span><span class="rs-val">{{ t('flashcards.cardsN', { n: flashcardStats.weekCount }) }}</span></div>
            <div class="reviewed-stat"><span class="rs-key">{{ t('flashcards.retention') }}</span><span class="rs-val ok">{{ flashcardStats.retention }}%</span></div>
          </div>
        </div>
      </div>

      <!-- Your decks -->
      <div class="col-12">
        <h3 class="decks-title">{{ t('flashcards.yourDecks') }}</h3>
        <div class="row g-3">
          <div v-for="d in sampleDecks" :key="d.id" class="col-12 col-md-6 col-xl-4">
            <div class="deck-card" role="button" @click="deck = d; idx = 0; flipped = false; tab='study'">
              <div class="dk-head">
                <span class="icon-tile dk-icon" :class="d.color">{{ d.subject.slice(0,3) }}</span>
                <div>
                  <div class="dk-name">{{ d.name }}</div>
                  <router-link
                    v-if="subjectByCode(d.subject)"
                    :to="{ name: 'subject-hub', params: { id: subjectByCode(d.subject).id } }"
                    class="dk-sub dk-sub-link"
                    @click.stop
                  >{{ d.subject }}</router-link>
                  <div v-else class="dk-sub">{{ d.subject }}</div>
                </div>
              </div>
              <div class="dk-foot">
                <span class="dk-count">{{ t('flashcards.deckCards', { n: d.total }) }}</span>
                <span class="badge-soft">{{ t('flashcards.deckDue', { n: d.due }) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- QUIZ MODE (manual quiz generator) -->
    <div v-else-if="tab==='quiz'">
      <div class="field-inline">
        <label>{{ t('flashcards.fromNote') }}</label>
        <select v-model="noteForGen" class="form-select note-select">
          <option v-for="n in sampleNotes" :key="n.id" :value="n">{{ n.title }}</option>
        </select>
      </div>
      <QuizGenerator :content="noteForGen.content" />
    </div>

    <!-- CREATE CARDS (manual flashcard generator + keyword analysis) -->
    <div v-else class="row g-4">
      <div class="col-12 col-xl-8">
        <div class="field-inline">
          <label>{{ t('flashcards.generateFromNote') }}</label>
          <select v-model="noteForGen" class="form-select note-select">
            <option v-for="n in sampleNotes" :key="n.id" :value="n">{{ n.title }}</option>
          </select>
          <span class="badge-soft">{{ t('flashcards.cardsViaPatterns', { n: generated.length }) }}</span>
        </div>
        <div class="row g-3">
          <div v-for="(c, i) in generated" :key="i" class="col-12 col-md-6">
            <div class="panel gen-card">
              <div class="gen-pattern">{{ t('flashcards.patternLabel', { pattern: c.pattern }) }}</div>
              <div class="gen-q">{{ c.question }}</div>
              <div class="gen-a">{{ c.answer }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-xl-4">
        <KeywordExtractor :content="noteForGen.content" />
      </div>
    </div>
  </div>
</template>
