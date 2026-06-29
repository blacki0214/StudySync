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
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useContentStore } from '../stores/contentStore.js'
import { useDialogStore } from '../stores/dialogStore.js'
import { isAiConfigured, generateFlashcards as aiGenerateFlashcards } from '../services/aiService.js'
import AppSelect from '../components/common/AppSelect.vue'
import StatCard from '../components/common/StatCard.vue'
import BarChart from '../components/charts/BarChart.vue'
import QuizGenerator from '../components/ai/QuizGenerator.vue'
import KeywordExtractor from '../components/ai/KeywordExtractor.vue'

const route = useRoute()
const { t } = useI18n()
const content = useContentStore()
const dialog = useDialogStore()
const subjectByCode = (code) => content.subjectByCode(code)
// Note picker options (value is the note object, matched by identity).
const noteOptions = computed(() => content.notes.map((n) => ({ value: n, label: n.title })))

const tab = ref('study')
const stats = computed(() => {
  const fs = content.flashcardStats || {}
  return [
    { label: t('flashcards.cardsMastered'), value: fs.mastered ?? 0, icon: 'bi-trophy', grad: 'grad-orange' },
    { label: t('flashcards.dueToday'), value: fs.dueToday ?? 0, icon: 'bi-bullseye', grad: 'grad-blue' },
    { label: t('flashcards.streak'), value: (fs.streak ?? 0) + 'd', icon: 'bi-fire', grad: 'grad-fuchsia' },
    { label: t('flashcards.avgRecall'), value: (fs.avgRecall ?? 0) + '%', icon: 'bi-clock', grad: 'grad-green' }
  ]
})
const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ---- Study mode ----
const deck = ref(null)
const idx = ref(0)
const flipped = ref(false)
const card = computed(() => deck.value?.cards?.[idx.value] || null)
const studyProgress = computed(() =>
  deck.value?.cards?.length ? ((idx.value + 1) / deck.value.cards.length) * 100 : 0
)

function rate() {
  if (!deck.value?.cards?.length) return
  flipped.value = false
  idx.value = (idx.value + 1) % deck.value.cards.length
}
function step(d) {
  if (!deck.value?.cards?.length) return
  flipped.value = false
  idx.value = (idx.value + d + deck.value.cards.length) % deck.value.cards.length
}

// ---- Create cards (AI generation from a note; manual fallback) ----
const noteForGen = ref(null)
const generated = ref([])
const generating = ref(false)

async function runGenerate() {
  if (!noteForGen.value) { generated.value = []; return }
  generating.value = true
  try {
    generated.value = await aiGenerateFlashcards(noteForGen.value.content, { max: 12 })
  } finally {
    generating.value = false
  }
}

// (Re)generate whenever the selected note changes — including the initial pick
// made in onMounted, which flips noteForGen from null to a note.
watch(noteForGen, runGenerate)

// Persist the generated cards as a studyable deck, then jump into Study mode.
const saving = ref(false)
async function saveAsDeck() {
  if (!generated.value.length) { dialog.toast(t('flashcards.noCardsToSave'), 'warning'); return }
  const name = await dialog.promptText({
    title: t('flashcards.saveDeck'),
    label: t('flashcards.deckName'),
    value: noteForGen.value?.title || t('flashcards.newDeck')
  })
  if (!name || !name.trim()) return

  // Resolve the note's subject code (decks store the code, notes store an id).
  const subject = content.subjects.find((s) => s.id === noteForGen.value?.subject_id)
  saving.value = true
  try {
    const newDeck = await content.createDeck({
      name: name.trim(),
      subjectCode: subject?.code || '',
      cards: generated.value.map((c) => ({ question: c.question, answer: c.answer }))
    })
    deck.value = newDeck
    idx.value = 0
    flipped.value = false
    tab.value = 'study'
    dialog.toast(t('flashcards.deckSaved', { n: newDeck.cards.length }), 'success')
  } catch {
    dialog.toast(t('flashcards.deckSaveFailed'), 'error')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await content.ensureLoaded()
  // If arriving from a note (/flashcards/:noteId), open straight into "create"
  // mode pre-loaded with that note.
  const fromNote = content.notes.find((n) => n.id === route.params.noteId)
  if (fromNote) tab.value = 'create'
  deck.value = content.decks[0] || null
  noteForGen.value = fromNote || content.notes[0] || null
})
</script>

<template>
  <div>
    <header class="page-head">
      <div>
        <h1 class="ph-title">{{ t('flashcards.title') }}</h1>
        <p class="ph-sub">{{ t('flashcards.sub', { due: content.flashcardStats?.dueToday ?? 0, decks: content.decks.length }) }}</p>
      </div>
      <div class="action-row">
        <button class="btn btn-outline-soft" @click="tab='create'"><i class="bi bi-stars"></i>{{ t('flashcards.aiGenerate') }}</button>
        <button class="btn btn-brand" @click="tab='create'"><i class="bi bi-plus-lg"></i>{{ t('flashcards.newDeck') }}</button>
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
      <div v-if="deck && card" class="col-12 col-xl-8">
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
          <BarChart :labels="weekLabels" :values="content.flashcardStats?.reviewedLast7 || []" :height="170" />
          <div class="reviewed-stats">
            <div class="reviewed-stat"><span class="rs-key">{{ t('flashcards.today') }}</span><span class="rs-val">{{ t('flashcards.cardsN', { n: content.flashcardStats?.todayCount ?? 0 }) }}</span></div>
            <div class="reviewed-stat"><span class="rs-key">{{ t('flashcards.thisWeek') }}</span><span class="rs-val">{{ t('flashcards.cardsN', { n: content.flashcardStats?.weekCount ?? 0 }) }}</span></div>
            <div class="reviewed-stat"><span class="rs-key">{{ t('flashcards.retention') }}</span><span class="rs-val ok">{{ content.flashcardStats?.retention ?? 0 }}%</span></div>
          </div>
        </div>
      </div>

      <!-- Your decks -->
      <div class="col-12">
        <h3 class="decks-title">{{ t('flashcards.yourDecks') }}</h3>
        <div class="row g-3">
          <div v-for="d in content.decks" :key="d.id" class="col-12 col-md-6 col-xl-4">
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
        <AppSelect v-model="noteForGen" class="note-select" :options="noteOptions" :aria-label="t('flashcards.fromNote')" />
      </div>
      <QuizGenerator v-if="noteForGen" :content="noteForGen.content" />
    </div>

    <!-- CREATE CARDS (manual flashcard generator + keyword analysis) -->
    <div v-else class="row g-4">
      <div class="col-12 col-xl-8">
        <div class="field-inline">
          <label>{{ t('flashcards.generateFromNote') }}</label>
          <AppSelect v-model="noteForGen" class="note-select" :options="noteOptions" :aria-label="t('flashcards.generateFromNote')" />
          <span v-if="generating" class="badge-soft"><i class="bi bi-arrow-repeat spin"></i> {{ t('flashcards.generating') }}</span>
          <span v-else class="badge-soft">{{ isAiConfigured ? t('flashcards.cardsViaAi', { n: generated.length }) : t('flashcards.cardsViaPatterns', { n: generated.length }) }}</span>
          <button class="btn btn-soft btn-sm" :disabled="generating || !noteForGen" @click="runGenerate"><i class="bi bi-stars"></i>{{ t('flashcards.regenerate') }}</button>
          <button class="btn btn-brand btn-sm" :disabled="saving || generating || !generated.length" @click="saveAsDeck">
            <i class="bi" :class="saving ? 'bi-arrow-repeat spin' : 'bi-folder-plus'"></i>{{ t('flashcards.saveDeck') }}
          </button>
        </div>
        <div class="row g-3">
          <div v-if="generating && !generated.length" class="col-12">
            <div class="panel gen-card text-muted-sm"><i class="bi bi-arrow-repeat spin"></i> {{ t('flashcards.generating') }}</div>
          </div>
          <div v-for="(c, i) in generated" :key="i" class="col-12 col-md-6">
            <div class="panel gen-card">
              <div class="gen-pattern">{{ c.pattern === 'ai' ? t('flashcards.aiBadge') : t('flashcards.patternLabel', { pattern: c.pattern }) }}</div>
              <div class="gen-q">{{ c.question }}</div>
              <div class="gen-a">{{ c.answer }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-12 col-xl-4">
        <KeywordExtractor v-if="noteForGen" :content="noteForGen.content" />
      </div>
    </div>
  </div>
</template>
