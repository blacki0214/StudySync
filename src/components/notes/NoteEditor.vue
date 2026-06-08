<script setup>
/**
 * NoteEditor — the collaborative editing surface.
 *
 * It is a thin, controlled view over the noteStore: every keystroke calls
 * `updateDraft`, which (a) updates local state instantly for an optimistic feel,
 * (b) broadcasts a typing signal to peers, and (c) re-arms the debounced
 * auto-save. The heavy lifting (debounce, conflict, versioning, presence) lives
 * in the store so this component stays declarative.
 */
import { storeToRefs } from 'pinia'
import { useNoteStore } from '../../stores/noteStore.js'

const noteStore = useNoteStore()
const { draft, saveStatus } = storeToRefs(noteStore)

function onTitle(e) {
  noteStore.updateDraft({ title: e.target.value })
}
function onContent(e) {
  noteStore.updateDraft({ content: e.target.value })
}
</script>

<template>
  <div class="editor-panel">
    <div class="editor-toolbar">
      <input
        class="editor-title-input"
        :value="draft.title"
        placeholder="Untitled note"
        @input="onTitle"
      />
      <!-- Save status + collaborator presence live in CollaborativeStatus,
           rendered by the parent view next to this toolbar via a slot. -->
      <slot name="status" />
    </div>

    <textarea
      class="editor-textarea"
      :value="draft.content"
      placeholder="Start writing your note. Try definition sentences like 'X is used for Y' so the flashcard generator has something to work with..."
      @input="onContent"
    ></textarea>

    <div class="px-4 pb-3 text-muted-sm d-flex align-items-center gap-2">
      <i class="bi bi-info-circle"></i>
      Auto-saves as you type (700&nbsp;ms debounce). Status:
      <strong class="text-capitalize">{{ saveStatus }}</strong>
    </div>
  </div>
</template>
