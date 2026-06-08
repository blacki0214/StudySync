<script setup>
/**
 * FlashcardGenerator — generates flip-able flashcards from note content using
 * the manual rule-based generator (NO AI API). Each card flips on click to show
 * the answer.
 */
import { ref, watch } from 'vue'
import { generateFlashcards } from '../../utils/flashcardGenerator.js'

const props = defineProps({
  content: { type: String, default: '' }
})

const cards = ref([])
const flipped = ref(new Set())

function regenerate() {
  cards.value = generateFlashcards(props.content, { maxCards: 12 })
  flipped.value = new Set()
}

function toggle(i) {
  const set = new Set(flipped.value)
  set.has(i) ? set.delete(i) : set.add(i)
  flipped.value = set
}

// Auto-generate whenever the source content changes.
watch(() => props.content, regenerate, { immediate: true })
</script>

<template>
  <div>
    <div class="generator-toolbar">
      <h2 class="section-title mb-0"><i class="bi bi-card-text"></i>Flashcards</h2>
      <span class="text-muted-sm">{{ cards.length }} generated from definition patterns</span>
      <button class="btn btn-soft ms-auto" @click="regenerate">
        <i class="bi bi-arrow-clockwise me-1"></i>Regenerate
      </button>
    </div>

    <div v-if="!cards.length" class="empty-state">
      <div class="empty-icon"><i class="bi bi-card-text"></i></div>
      <p class="text-muted-sm">No definition-style sentences were found. Try writing sentences like
        “X is …”, “X refers to …” or “X is used for …”.</p>
    </div>

    <div v-else class="row g-3">
      <div v-for="(card, i) in cards" :key="i" class="col-12 col-md-6 col-lg-4">
        <div class="flashcard" :class="{ flipped: flipped.has(i) }" @click="toggle(i)">
          <div class="flashcard-inner">
            <div class="flashcard-face flashcard-front">
              <div class="fc-label">Question</div>
              <div class="fc-text">{{ card.question }}</div>
              <div class="flashcard-hint">Click to reveal answer</div>
            </div>
            <div class="flashcard-face flashcard-back">
              <div class="fc-label">Answer</div>
              <div class="fc-text">{{ card.answer }}</div>
              <div class="flashcard-hint">pattern: “{{ card.pattern }}”</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
