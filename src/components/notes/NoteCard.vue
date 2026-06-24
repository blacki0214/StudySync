<script setup>
/**
 * NoteCard — compact preview of a note in the notes/subjects lists.
 * Computes a quick difficulty pill on the fly using the manual analyzer.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { timeAgo } from '../../utils/formatDate.js'
import { htmlToText } from '../../utils/html.js'

const props = defineProps({
  note: { type: Object, required: true },
  subjectCode: { type: String, default: '' },
  deletable: { type: Boolean, default: false }
})
defineEmits(['delete'])
const { t } = useI18n()

const plain = computed(() => htmlToText(props.note.content))
const excerpt = computed(() => plain.value.slice(0, 180))
</script>

<template>
  <router-link :to="`/notes/${note.id}`" class="note-card text-reset text-decoration-none">
    <button
      v-if="deletable"
      type="button"
      class="note-del-btn"
      :title="t('notes.deleteNote')"
      :aria-label="t('notes.deleteNote')"
      @click.prevent.stop="$emit('delete', note)"
    ><i class="bi bi-trash3"></i></button>
    <div class="d-flex align-items-start gap-2">
      <span class="badge-soft">{{ subjectCode || 'Note' }}</span>
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
