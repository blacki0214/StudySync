<script setup>
/**
 * NoteCard — compact preview of a note in the notes/subjects lists.
 * Computes a quick difficulty pill on the fly using the manual analyzer.
 */
import { computed } from 'vue'
import { analyzeDifficulty } from '../../utils/difficultyAnalyzer.js'
import { timeAgo } from '../../utils/formatDate.js'
import { htmlToText } from '../../utils/html.js'

const props = defineProps({
  note: { type: Object, required: true },
  subjectCode: { type: String, default: '' }
})

const plain = computed(() => htmlToText(props.note.content))
const difficulty = computed(() => analyzeDifficulty(plain.value).level)
const excerpt = computed(() => plain.value.slice(0, 180))
</script>

<template>
  <router-link :to="`/notes/${note.id}`" class="note-card text-reset text-decoration-none">
    <div class="d-flex align-items-start justify-content-between gap-2">
      <span class="badge-soft">{{ subjectCode || 'Note' }}</span>
      <span class="difficulty-pill" :class="`difficulty-${difficulty}`">{{ difficulty }}</span>
    </div>
    <div class="note-title mt-3">{{ note.title }}</div>
    <p class="note-excerpt">{{ excerpt }}</p>
    <div class="note-meta">
      <span><i class="bi bi-heart-fill text-danger me-1"></i>{{ note.likes_count }}</span>
      <span><i class="bi bi-clock-history me-1"></i>v{{ note.version }}</span>
      <span class="meta-spacer">{{ timeAgo(note.updated_at) }}</span>
    </div>
  </router-link>
</template>
