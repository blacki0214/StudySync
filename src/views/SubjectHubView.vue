<script setup>
/**
 * SubjectHubView — the "everything for one subject" page. Brings together a
 * subject's collaborative notes, flashcard decks, live study rooms and community
 * Q&A in one place, so studying is organised around the subject.
 *
 * Data bridge: notes/rooms reference the subject by id; decks/community by code.
 * We resolve the subject once from the :id, then filter decks/community by its
 * code (see subjectByCode). Every section guards with an empty state.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSubjectStore } from '../stores/subjectStore.js'
import { useNoteStore } from '../stores/noteStore.js'
import { useContentStore } from '../stores/contentStore.js'
import NoteCard from '../components/notes/NoteCard.vue'
import StudyRoomCard from '../components/study/StudyRoomCard.vue'
import EmptyState from '../components/common/EmptyState.vue'

const props = defineProps({ id: { type: String, required: true } })
const { t } = useI18n()
const subjectStore = useSubjectStore()
const noteStore = useNoteStore()
const content = useContentStore()
const tab = ref('notes')
const userById = (id) => content.userById(id)

onMounted(async () => {
  if (!subjectStore.subjects.length) await subjectStore.fetchSubjects()
  await Promise.all([noteStore.fetchNotes(), content.ensureLoaded()])
})

const subject = computed(() => subjectStore.getById(props.id))

const notes = computed(() => noteStore.notes.filter((n) => n.subject_id === props.id))
const decks = computed(() => content.decks.filter((d) => d.subject === subject.value?.code))
const rooms = computed(() => content.rooms.filter((r) => r.subject_id === props.id))
const posts = computed(() => content.posts.filter((p) => p.subject === subject.value?.code))

const tabs = computed(() => [
  { key: 'notes', label: t('subjectHub.notes'), count: notes.value.length },
  { key: 'decks', label: t('subjectHub.decks'), count: decks.value.length },
  { key: 'rooms', label: t('subjectHub.rooms'), count: rooms.value.length },
  { key: 'community', label: t('subjectHub.community'), count: posts.value.length }
])

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
  <div v-if="subject">
    <!-- Subject header -->
    <div class="subject-hub-head">
      <span class="icon-tile shh-badge" :class="subject.color">{{ subject.letters }}</span>
      <div class="shh-main">
        <div class="shh-eyebrow">{{ subject.code }} · {{ subject.category }}</div>
        <h1 class="shh-name">{{ subject.name }}</h1>
        <p class="shh-desc">{{ subject.description }}</p>
        <div class="shh-meta">
          <span class="shh-rating"><i class="bi bi-star-fill"></i>{{ subject.rating }}</span>
          <span>{{ t('subjects.studentsCount', { n: subject.students.toLocaleString() }) }}</span>
          <span>{{ t('subjects.notesCount', { n: subject.notes_count }) }}</span>
        </div>
      </div>
      <div class="shh-progress" v-if="subject.progress">
        <div class="shh-progress-val">{{ subject.progress }}%</div>
        <div class="progress-track"><div class="progress-fill" :style="{ width: subject.progress + '%' }"></div></div>
      </div>
    </div>

    <!-- Section switcher -->
    <div class="seg-tabs subject-hub-tabs">
      <button
        v-for="tb in tabs"
        :key="tb.key"
        class="seg-tab"
        :class="{ active: tab === tb.key }"
        @click="tab = tb.key"
      >{{ tb.label }} <span class="seg-count">{{ tb.count }}</span></button>
    </div>

    <!-- Notes -->
    <div v-if="tab === 'notes'">
      <div class="shh-notes-bar">
        <router-link :to="{ name: 'notes', query: { subject: props.id } }" class="btn btn-outline-soft btn-sm">
          <i class="bi bi-box-arrow-up-right"></i>{{ t('subjectHub.openInNotes') }}
        </router-link>
        <router-link :to="{ name: 'notes', query: { subject: props.id, new: 1 } }" class="btn btn-brand btn-sm">
          <i class="bi bi-plus-lg"></i>{{ t('subjectHub.newNote') }}
        </router-link>
      </div>
      <EmptyState v-if="!notes.length" icon="bi-sticky" :title="t('subjectHub.noNotes')" />
      <div v-else class="row g-4">
        <div v-for="n in notes" :key="n.id" class="col-12 col-md-6 col-xl-4">
          <NoteCard :note="n" :subject-code="subject.code" />
        </div>
      </div>
    </div>

    <!-- Decks -->
    <div v-else-if="tab === 'decks'">
      <EmptyState v-if="!decks.length" icon="bi-stars" :title="t('subjectHub.noDecks')" />
      <div v-else class="row g-3">
        <div v-for="d in decks" :key="d.id" class="col-12 col-md-6 col-xl-4">
          <router-link to="/flashcards" class="deck-card deck-link">
            <div class="dk-head">
              <span class="icon-tile dk-icon" :class="d.color">{{ d.subject.slice(0,3) }}</span>
              <div>
                <div class="dk-name">{{ d.name }}</div>
                <div class="dk-sub">{{ d.subject }}</div>
              </div>
            </div>
            <div class="dk-foot">
              <span class="dk-count">{{ t('flashcards.deckCards', { n: d.total }) }}</span>
              <span class="badge-soft">{{ t('flashcards.deckDue', { n: d.due }) }}</span>
            </div>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Rooms -->
    <div v-else-if="tab === 'rooms'">
      <EmptyState v-if="!rooms.length" icon="bi-people" :title="t('subjectHub.noRooms')" />
      <div v-else class="row g-4">
        <div v-for="r in rooms" :key="r.id" class="col-12 col-md-6 col-xl-4">
          <StudyRoomCard :room="{ ...r, subject }" />
        </div>
      </div>
    </div>

    <!-- Community -->
    <div v-else>
      <EmptyState v-if="!posts.length" icon="bi-chat-square-text" :title="t('subjectHub.noPosts')" />
      <div v-else>
        <router-link v-for="p in posts" :key="p.id" to="/community" class="post-card shh-post">
          <div class="vote-col">
            <span class="vote-btn"><i class="bi bi-arrow-up"></i></span>
            <span class="vote-count">{{ p.votes }}</span>
          </div>
          <div class="post-body">
            <div class="post-head">
              <img v-if="userById(p.author_id)?.avatar" :src="userById(p.author_id).avatar" class="avatar-ring ph-avatar" :alt="p.author_id" />
              <span v-else class="user-avatar ph-avatar">{{ initials(userById(p.author_id)?.full_name) }}</span>
              <span class="ph-name">{{ userById(p.author_id)?.full_name }}</span>
              <span class="ph-meta">· {{ p.ago }}</span>
            </div>
            <div class="post-title">{{ p.title }}</div>
            <div class="post-excerpt">{{ p.excerpt }}</div>
            <div class="post-foot"><span><i class="bi bi-chat"></i>{{ t('community.replies', { n: p.replies }) }}</span></div>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>
