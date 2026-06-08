<script setup>
/**
 * NoteDetailView — the real-time COLLABORATIVE EDITOR page.
 *
 * Lifecycle:
 *   • onMounted    -> noteStore.openNote(id): loads content + version history and
 *                     joins the realtime channel (presence + remote updates +
 *                     typing broadcasts).
 *   • while open   -> NoteEditor pushes keystrokes into the store, which handles
 *                     debounced auto-save, optimistic update and version-conflict
 *                     detection.
 *   • onUnmounted  -> noteStore.closeNote(): leaves the channel and clears timers.
 *
 * The conflict banner appears when another user's save bumped the version while
 * we had local changes; the user chooses to keep their edits (rebase + retry) or
 * take the other version.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useNoteStore } from '../stores/noteStore.js'
import { useSubjectStore } from '../stores/subjectStore.js'
import NoteEditor from '../components/notes/NoteEditor.vue'
import CollaborativeStatus from '../components/notes/CollaborativeStatus.vue'
import OnlineUsersPanel from '../components/study/OnlineUsersPanel.vue'
import VersionHistory from '../components/notes/VersionHistory.vue'
import KeywordExtractor from '../components/ai/KeywordExtractor.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'

const route = useRoute()
const router = useRouter()
const noteStore = useNoteStore()
const subjectStore = useSubjectStore()

const { activeNote, draft, onlineUsers, versions, conflict, baseVersion } = storeToRefs(noteStore)
const ready = ref(false)

onMounted(async () => {
  if (!subjectStore.subjects.length) await subjectStore.fetchSubjects()
  try {
    await noteStore.openNote(route.params.id)
  } catch (e) {
    router.replace('/notes')
    return
  }
  ready.value = true
})

// Leaving the page tears down the realtime session.
onUnmounted(() => noteStore.closeNote())

const subjectCode = computed(
  () => subjectStore.getById(activeNote.value?.subject_id)?.code || 'Note'
)

// Restore a previous version into the draft (then a save will create a new one).
function restoreVersion(v) {
  noteStore.updateDraft({ content: v.content })
}
</script>

<template>
  <LoadingSpinner v-if="!ready" label="Opening collaborative editor..." />

  <div v-else>
    <div class="page-header d-flex justify-content-between align-items-center flex-wrap gap-2">
      <div>
        <router-link to="/notes" class="text-muted-sm"><i class="bi bi-arrow-left me-1"></i>Back to notes</router-link>
        <h1 class="mt-1 mb-0">
          <span class="badge-soft me-2">{{ subjectCode }}</span>
          {{ draft.title || 'Untitled note' }}
        </h1>
      </div>
      <router-link
        :to="`/flashcards/${activeNote.id}`"
        class="btn btn-brand"
      >
        <i class="bi bi-lightning-charge me-1"></i>Study tools
      </router-link>
    </div>

    <!-- Version-conflict warning -->
    <div v-if="conflict" class="conflict-banner">
      <div class="cb-title">
        <i class="bi bi-exclamation-triangle-fill"></i>
        This note was updated by another user. Please review before saving.
      </div>
      <p class="text-muted-sm mb-0 mt-1">
        A newer version (v{{ conflict.currentVersion }}) exists on the server while you were editing
        (your base was v{{ baseVersion }}).
      </p>
      <div class="cb-actions">
        <button class="btn btn-brand btn-sm" @click="noteStore.resolveConflictKeepMine">
          Keep my changes
        </button>
        <button class="btn btn-soft btn-sm" @click="noteStore.resolveConflictUseTheirs">
          Use their version
        </button>
      </div>
    </div>

    <div class="editor-layout">
      <!-- Editor + live collaboration HUD -->
      <NoteEditor>
        <template #status>
          <CollaborativeStatus />
        </template>
      </NoteEditor>

      <!-- Right rail: presence, version history, live keywords -->
      <div class="editor-side">
        <OnlineUsersPanel :users="onlineUsers" title="In this note" />
        <VersionHistory :versions="versions" @restore="restoreVersion" />
        <KeywordExtractor :content="draft.content" :limit="10" />
      </div>
    </div>
  </div>
</template>
