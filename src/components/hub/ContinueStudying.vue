<script setup>
/**
 * ContinueStudying — the Hub's "jump back in" row. Surfaces the three most
 * natural things to resume: the last edited note, a deck with cards due, and a
 * live study room. Each card links straight into its feature.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { sampleNotes } from '../../data/sampleNotes.js'
import { sampleDecks } from '../../data/sampleDecks.js'
import { sampleRooms } from '../../data/sampleRooms.js'
import { subjectById } from '../../data/sampleSubjects.js'

const { t } = useI18n()

// Most-recently edited note.
const note = computed(() =>
  [...sampleNotes].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0]
)
const noteSubject = computed(() => subjectById(note.value?.subject_id))
const deck = computed(() => sampleDecks.find((d) => d.due > 0) || sampleDecks[0])
const room = computed(() => sampleRooms.find((r) => r.live) || sampleRooms[0])
</script>

<template>
  <section class="continue-row row g-3 row-gap-section">
    <!-- Resume the last note -->
    <div class="col-12 col-md-4">
      <router-link :to="{ name: 'note-detail', params: { id: note.id } }" class="continue-card">
        <span class="continue-icon grad-blue"><i class="bi bi-pencil-square"></i></span>
        <div class="continue-body">
          <div class="continue-label">{{ t('hub.continueEditing') }}</div>
          <div class="continue-title">{{ note.title }}</div>
          <div class="continue-meta">{{ noteSubject?.code }} · {{ t('hub.lastEdited') }}</div>
        </div>
        <i class="bi bi-arrow-right continue-go"></i>
      </router-link>
    </div>

    <!-- Review a due deck -->
    <div class="col-12 col-md-4">
      <router-link to="/flashcards" class="continue-card">
        <span class="continue-icon grad-orange"><i class="bi bi-stars"></i></span>
        <div class="continue-body">
          <div class="continue-label">{{ t('hub.reviewDeck') }}</div>
          <div class="continue-title">{{ deck.name }}</div>
          <div class="continue-meta">{{ t('flashcards.deckDue', { n: deck.due }) }}</div>
        </div>
        <i class="bi bi-arrow-right continue-go"></i>
      </router-link>
    </div>

    <!-- Join a live room -->
    <div class="col-12 col-md-4">
      <router-link :to="{ name: 'study-room', params: { id: room.id } }" class="continue-card">
        <span class="continue-icon grad-green"><i class="bi bi-camera-video"></i></span>
        <div class="continue-body">
          <div class="continue-label">{{ t('hub.joinRoom') }}</div>
          <div class="continue-title">{{ room.name }}</div>
          <div class="continue-meta"><span class="dot-online"></span> {{ t('hub.liveNow') }}</div>
        </div>
        <i class="bi bi-arrow-right continue-go"></i>
      </router-link>
    </div>
  </section>
</template>
