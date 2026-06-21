<script setup>
/**
 * QuickLaunch — a row of one-tap entry points into every feature, so the Hub
 * acts as a launcher. The command palette (⌘K) offers the same actions plus
 * search; these tiles are the discoverable, always-visible version.
 */
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const tiles = [
  { to: '/notes', icon: 'bi-plus-lg', grad: 'grad-blue', key: 'hub.newNote' },
  { to: '/flashcards', icon: 'bi-stars', grad: 'grad-orange', key: 'hub.generateFlashcards' },
  { to: '/rooms', icon: 'bi-camera-video', grad: 'grad-green', key: 'hub.joinRoom' },
  { to: '/community', icon: 'bi-chat-square-text', grad: 'grad-fuchsia', key: 'hub.askCommunity' },
  { to: '/subjects', icon: 'bi-journal-bookmark', grad: 'grad-blue', key: 'hub.browseSubjects' }
]
</script>

<template>
  <section class="quick-launch row g-3 row-gap-section">
    <div v-for="tile in tiles" :key="tile.to" class="col-6 col-md-4 col-xl">
      <router-link :to="tile.to" class="quick-tile">
        <span class="quick-icon" :class="tile.grad"><i class="bi" :class="tile.icon"></i></span>
        <span class="quick-label">{{ t(tile.key) }}</span>
      </router-link>
    </div>
  </section>
</template>
