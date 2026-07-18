<script setup>
/**
 * MobileHeader — the app-style top bar for phones (see App.vue). It is NOT the
 * desktop navbar shrunk down: it shows the current screen's title on the left
 * (with a back chevron on detail screens) and contextual actions on the right —
 * global search (⌘K palette) and the notification bell. Only rendered when
 * uiStore.isMobile is true.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { usePaletteStore } from '../../stores/paletteStore.js'
import NotificationBell from './NotificationBell.vue'

const route = useRoute()
const router = useRouter()
const palette = usePaletteStore()
const { t } = useI18n()

// route name → i18n title key for the header.
const TITLES = {
  hub: 'nav.hub',
  subjects: 'nav.subjects',
  'my-subjects': 'nav.mySubjects',
  'subject-hub': 'nav.subjects',
  'subject-workspace': 'nav.subjects',
  notes: 'nav.collabNotes',
  'note-detail': 'nav.collabNotes',
  'note-share': 'nav.collabNotes',
  tasks: 'nav.tasks',
  schedule: 'nav.schedule',
  rooms: 'nav.studyRooms',
  'study-room': 'nav.studyRooms',
  flashcards: 'nav.flashcards',
  'flashcards-note': 'nav.flashcards',
  community: 'nav.community',
  classes: 'nav.classes',
  'class-detail': 'nav.classes',
  'join-class': 'nav.joinClass',
  settings: 'nav.settings'
}

// Detail / nested screens get a back chevron so navigation feels app-native.
const DETAIL = new Set([
  'subject-hub', 'subject-workspace', 'note-detail', 'note-share',
  'study-room', 'flashcards-note', 'class-detail', 'join-class'
])

const title = computed(() => t(TITLES[route.name] || 'nav.hub'))
const showBack = computed(() => DETAIL.has(route.name))

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/hub')
}
</script>

<template>
  <header class="m-header">
    <div class="m-header-top">
      <button v-if="showBack" class="m-header-btn" :aria-label="t('mobile.back')" @click="goBack">
        <i class="bi bi-chevron-left"></i>
      </button>
      <h1 class="m-header-title">{{ title }}</h1>

      <div class="m-header-actions">
        <!-- Detail pages keep a compact icon (their row has no search pill). -->
        <button v-if="showBack" class="m-header-btn" :aria-label="t('nav.search')" @click="palette.show()">
          <i class="bi bi-search"></i>
        </button>
        <NotificationBell placement="down" />
      </div>
    </div>

    <!-- Instagram-style search pill: always visible on top-level pages. -->
    <div v-if="!showBack" class="m-header-search">
      <button class="m-search-pill" @click="palette.show()">
        <i class="bi bi-search"></i>
        <span>{{ t('nav.search') }}</span>
      </button>
    </div>
  </header>
</template>
