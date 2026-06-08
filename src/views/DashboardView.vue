<script setup>
/**
 * DashboardView — landing screen after login. Aggregates data from the subject
 * and note stores and renders the stat cards, recent notes, popular subjects
 * and leaderboard. Leaderboard data is derived from the sample authors so the
 * page is lively in demo mode.
 */
import { computed, onMounted } from 'vue'
import { useNoteStore } from '../stores/noteStore.js'
import { useSubjectStore } from '../stores/subjectStore.js'
import { useAuthStore } from '../stores/authStore.js'
import DashboardStats from '../components/dashboard/DashboardStats.vue'
import RecentNotes from '../components/dashboard/RecentNotes.vue'
import PopularSubjects from '../components/dashboard/PopularSubjects.vue'
import Leaderboard from '../components/dashboard/Leaderboard.vue'

const noteStore = useNoteStore()
const subjectStore = useSubjectStore()
const auth = useAuthStore()

onMounted(async () => {
  await Promise.all([subjectStore.fetchSubjects(), noteStore.fetchNotes()])
})

// Note count per subject for the popular-subjects panel.
const counts = computed(() => {
  const map = {}
  noteStore.notes.forEach((n) => (map[n.subject_id] = (map[n.subject_id] || 0) + 1))
  return map
})

const stats = computed(() => [
  { icon: 'bi-journal-text', value: noteStore.notes.length, label: 'Notes', grad: 'bg-grad-1' },
  { icon: 'bi-journal-bookmark', value: subjectStore.subjects.length, label: 'Subjects', grad: 'bg-grad-2' },
  {
    icon: 'bi-heart',
    value: noteStore.notes.reduce((s, n) => s + (n.likes_count || 0), 0),
    label: 'Total likes',
    grad: 'bg-grad-3'
  },
  { icon: 'bi-star', value: auth.user?.reputation ?? 0, label: 'Your reputation', grad: 'bg-grad-4' }
])

const recent = computed(() => noteStore.notes.slice(0, 5))

// Demo leaderboard derived from a few well-known contributors.
const leaders = computed(() =>
  [
    { id: 'user-1', full_name: 'Demo Student', reputation: auth.user?.reputation ?? 120 },
    { id: 'user-2', full_name: 'Linh Nguyen', reputation: 98 },
    { id: 'user-3', full_name: 'Minh Tran', reputation: 76 },
    { id: 'user-4', full_name: 'Hoa Pham', reputation: 54 }
  ].sort((a, b) => b.reputation - a.reputation)
)
</script>

<template>
  <div>
    <div class="page-header">
      <h1>Welcome back, {{ auth.displayName }} 👋</h1>
      <p>Here's what's happening across your subjects today.</p>
    </div>

    <DashboardStats :stats="stats" class="mb-4" />

    <div class="row g-4">
      <div class="col-12 col-lg-6">
        <RecentNotes :notes="recent" />
      </div>
      <div class="col-12 col-lg-6">
        <PopularSubjects :subjects="subjectStore.subjects.slice(0, 5)" :counts="counts" />
      </div>
      <div class="col-12 col-lg-6">
        <Leaderboard :users="leaders" />
      </div>
      <div class="col-12 col-lg-6">
        <div class="panel h-100 d-flex flex-column justify-content-center align-items-start">
          <div class="section-title"><i class="bi bi-lightning-charge"></i>Quick actions</div>
          <div class="d-flex flex-wrap gap-2">
            <router-link to="/notes" class="btn btn-brand"><i class="bi bi-plus-lg me-1"></i>New note</router-link>
            <router-link to="/flashcards" class="btn btn-soft"><i class="bi bi-card-text me-1"></i>Generate flashcards</router-link>
            <router-link to="/subjects" class="btn btn-soft"><i class="bi bi-journal me-1"></i>Browse subjects</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
