<script setup>
/**
 * CommunityView — a social feed of public notes presented as shareable posts,
 * with like + open actions. Likes are optimistic (updated locally on click).
 */
import { ref, computed, onMounted } from 'vue'
import { useNoteStore } from '../stores/noteStore.js'
import { useSubjectStore } from '../stores/subjectStore.js'
import { timeAgo } from '../utils/formatDate.js'
import { analyzeDifficulty } from '../utils/difficultyAnalyzer.js'

const noteStore = useNoteStore()
const subjectStore = useSubjectStore()
const liked = ref(new Set())

const authors = {
  'user-1': 'Demo Student',
  'user-2': 'Linh Nguyen',
  'user-3': 'Minh Tran'
}

onMounted(async () => {
  await Promise.all([noteStore.fetchNotes(), subjectStore.fetchSubjects()])
})

const posts = computed(() =>
  noteStore.notes
    .filter((n) => n.visibility !== 'private')
    .map((n) => ({
      ...n,
      author: authors[n.author_id] || 'Student',
      subjectCode: subjectStore.getById(n.subject_id)?.code || '',
      difficulty: analyzeDifficulty(n.content).level
    }))
)

function initials(name) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function toggleLike(note) {
  const set = new Set(liked.value)
  if (set.has(note.id)) {
    set.delete(note.id)
    note.likes_count--
  } else {
    set.add(note.id)
    note.likes_count++
  }
  liked.value = set
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1>Community</h1>
      <p>Discover what other students are sharing across all subjects.</p>
    </div>

    <div class="row">
      <div class="col-12 col-lg-8">
        <div v-for="post in posts" :key="post.id" class="community-post">
          <div class="cp-head">
            <span class="cp-avatar">{{ initials(post.author) }}</span>
            <div>
              <div class="fw-semibold">{{ post.author }}</div>
              <div class="text-muted-sm">{{ timeAgo(post.created_at) }} · {{ post.subjectCode }}</div>
            </div>
            <span class="difficulty-pill ms-auto" :class="`difficulty-${post.difficulty}`">{{ post.difficulty }}</span>
          </div>

          <h5 class="mb-2">{{ post.title }}</h5>
          <p class="text-muted-sm">{{ post.content.slice(0, 220) }}…</p>

          <div class="cp-actions">
            <span :class="{ 'text-danger': liked.has(post.id) }" @click="toggleLike(post)">
              <i class="bi" :class="liked.has(post.id) ? 'bi-heart-fill' : 'bi-heart'"></i>
              {{ post.likes_count }} likes
            </span>
            <router-link :to="`/notes/${post.id}`" class="text-reset text-decoration-none">
              <span><i class="bi bi-box-arrow-up-right"></i> Open note</span>
            </router-link>
            <router-link :to="`/flashcards/${post.id}`" class="text-reset text-decoration-none">
              <span><i class="bi bi-lightning-charge"></i> Study</span>
            </router-link>
          </div>
        </div>
      </div>

      <div class="col-12 col-lg-4">
        <div class="panel">
          <div class="section-title"><i class="bi bi-info-circle"></i>About the community</div>
          <p class="text-muted-sm mb-0">
            Public notes from every subject appear here. Like the ones you find useful, open them to
            read or co-edit in real time, or generate flashcards and quizzes instantly.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
