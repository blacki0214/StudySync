<script setup>
/** ProfileView — the current user's profile, stats and their authored notes. */
import { computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/authStore.js'
import { useNoteStore } from '../stores/noteStore.js'
import { useSubjectStore } from '../stores/subjectStore.js'
import NoteCard from '../components/notes/NoteCard.vue'
import EmptyState from '../components/common/EmptyState.vue'

const auth = useAuthStore()
const noteStore = useNoteStore()
const subjectStore = useSubjectStore()

onMounted(async () => {
  await Promise.all([noteStore.fetchNotes(), subjectStore.fetchSubjects()])
})

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

const myNotes = computed(() => noteStore.notes.filter((n) => n.author_id === auth.user?.id))
const totalLikes = computed(() => myNotes.value.reduce((s, n) => s + (n.likes_count || 0), 0))
const subjectCode = (id) => subjectStore.getById(id)?.code || ''
</script>

<template>
  <div>
    <div class="profile-header">
      <div class="profile-avatar-lg">{{ initials(auth.displayName) }}</div>
      <div class="flex-grow-1">
        <h2 class="ph-name">{{ auth.displayName }}</h2>
        <div class="ph-email">{{ auth.user?.email }}</div>
        <span class="badge-soft mt-2 d-inline-block"><i class="bi bi-star-fill me-1"></i>{{ auth.user?.reputation ?? 0 }} reputation</span>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-4">
        <div class="panel profile-stat">
          <div class="ps-value">{{ myNotes.length }}</div>
          <div class="ps-label">Notes authored</div>
        </div>
      </div>
      <div class="col-4">
        <div class="panel profile-stat">
          <div class="ps-value">{{ totalLikes }}</div>
          <div class="ps-label">Likes received</div>
        </div>
      </div>
      <div class="col-4">
        <div class="panel profile-stat">
          <div class="ps-value">{{ auth.user?.reputation ?? 0 }}</div>
          <div class="ps-label">Reputation</div>
        </div>
      </div>
    </div>

    <h2 class="section-title"><i class="bi bi-journal-text"></i>My notes</h2>

    <EmptyState
      v-if="!myNotes.length"
      icon="bi-journal"
      title="You haven't created any notes yet"
      message="Head to the Notes page to write your first one."
    >
      <router-link to="/notes" class="btn btn-brand mt-2"><i class="bi bi-plus-lg me-1"></i>Create a note</router-link>
    </EmptyState>

    <div v-else class="row g-4">
      <div v-for="n in myNotes" :key="n.id" class="col-12 col-md-6 col-lg-4">
        <NoteCard :note="n" :subject-code="subjectCode(n.subject_id)" />
      </div>
    </div>
  </div>
</template>
