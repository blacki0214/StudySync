<script setup>
/**
 * AiToolsDrawer — a right slide-over that runs the MANUAL "AI" utilities on the
 * note currently being edited (the live draft). It keeps the document visible
 * while showing a generated summary, key terms, difficulty analysis and a
 * flashcard preview, and links out to the full flashcards/quiz page.
 *
 * On open it calls aiStore.analyze(content) (which runs every rule-based util
 * once and caches the results). No external AI API.
 */
import { watch, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAiStore } from '../../stores/aiStore.js'
import { generateFlashcards } from '../../utils/flashcardGenerator.js'
import StudySummary from './StudySummary.vue'
import KeywordExtractor from './KeywordExtractor.vue'
import DifficultyHeatmap from '../study/DifficultyHeatmap.vue'

const { t } = useI18n()
const aiStore = useAiStore()

const props = defineProps({
  open: { type: Boolean, default: false },
  content: { type: String, default: '' },
  noteId: { type: String, default: '' }
})
const emit = defineEmits(['update:open'])

// Re-run the analysis each time the drawer opens.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.content) aiStore.analyze(props.content)
  }
)

const flashcards = computed(() => generateFlashcards(props.content, { maxCards: 6 }))

function close() {
  emit('update:open', false)
}

// Close on Escape while open.
function onKey(e) {
  if (props.open && e.key === 'Escape') close()
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <transition name="drawer">
    <div v-if="open" class="ai-drawer-wrap">
      <button class="ai-drawer-backdrop" :aria-label="t('common.cancel')" @click="close"></button>

      <aside class="ai-drawer" role="dialog" aria-modal="true">
        <header class="ai-drawer-head">
          <div>
            <div class="ai-drawer-title"><i class="bi bi-stars"></i>{{ t('editor.aiToolsTitle') }}</div>
            <div class="ai-drawer-sub">{{ t('editor.aiToolsSub') }}</div>
          </div>
          <button class="btn-icon-sq" :aria-label="t('common.cancel')" @click="close"><i class="bi bi-x-lg"></i></button>
        </header>

        <div class="ai-drawer-body">
          <StudySummary :content="content" />
          <KeywordExtractor :content="content" />
          <DifficultyHeatmap v-if="aiStore.difficulty" :analysis="aiStore.difficulty" />

          <!-- Flashcard preview -->
          <div class="panel">
            <div class="section-title"><i class="bi bi-card-text"></i>{{ t('editor.aiFlashcards') }}</div>
            <p v-if="!flashcards.length" class="tool-empty">{{ t('editor.aiFlashcardsEmpty') }}</p>
            <div v-for="(c, i) in flashcards" :key="i" class="ai-fc">
              <div class="ai-fc-q">{{ c.question }}</div>
              <div class="ai-fc-a">{{ c.answer }}</div>
            </div>
          </div>
        </div>

        <footer class="ai-drawer-foot">
          <router-link :to="`/flashcards/${noteId}`" class="btn btn-brand ai-drawer-cta">
            <i class="bi bi-arrow-up-right"></i>{{ t('editor.openFullFlashcards') }}
          </router-link>
        </footer>
      </aside>
    </div>
  </transition>
</template>
