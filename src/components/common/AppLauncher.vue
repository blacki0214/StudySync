<script setup>
/**
 * AppLauncher — a Google-style "apps grid" (waffle) launcher in the top bar.
 * Opens a popover grid of colourful feature tiles; each navigates to that
 * feature's own full page. Uses a Bootstrap dropdown (auto-closes on select).
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/authStore.js'

const { t } = useI18n()
const auth = useAuthStore()

// `roles` (optional) limits a tile to specific roles; tiles without it show to all.
const allFeatures = [
  { to: '/hub', icon: 'bi-compass', grad: 'grad-blue', key: 'nav.hub' },
  { to: '/my-subjects', icon: 'bi-folder-fill', grad: 'grad-blue', key: 'nav.mySubjects' },
  { to: '/subjects', icon: 'bi-journal-bookmark-fill', grad: 'grad-green', key: 'nav.subjects' },
  { to: '/notes', icon: 'bi-file-earmark-text', grad: 'grad-fuchsia', key: 'nav.collabNotes' },
  { to: '/tasks', icon: 'bi-check2-square', grad: 'grad-blue', key: 'nav.tasks' },
  { to: '/schedule', icon: 'bi-calendar-week-fill', grad: 'grad-orange', key: 'nav.schedule' },
  { to: '/rooms', icon: 'bi-people-fill', grad: 'grad-orange', key: 'nav.studyRooms' },
  { to: '/flashcards', icon: 'bi-stars', grad: 'grad-blue', key: 'nav.flashcards' },
  { to: '/community', icon: 'bi-chat-square-text-fill', grad: 'grad-fuchsia', key: 'nav.community' },
  { to: '/classes', icon: 'bi-easel2-fill', grad: 'grad-orange', key: 'nav.classes' },
  { to: '/join', icon: 'bi-box-arrow-in-right', grad: 'grad-green', key: 'nav.joinClass' },
  { to: '/settings', icon: 'bi-gear-fill', grad: 'grad-green', key: 'nav.settings' }
]

const features = computed(() =>
  allFeatures.filter((f) => !f.roles || f.roles.includes(auth.role))
)
</script>

<template>
  <div class="dropdown">
    <button class="icon-btn" :aria-label="t('nav.allFeatures')" :title="t('nav.allFeatures')" data-bs-toggle="dropdown">
      <i class="bi bi-grid-3x3-gap-fill"></i>
    </button>

    <div class="dropdown-menu dropdown-menu-end launcher-menu">
      <div class="launcher-title">{{ t('nav.allFeatures') }}</div>
      <div class="launcher-grid">
        <router-link v-for="f in features" :key="f.to" :to="f.to" class="launcher-tile">
          <span class="launcher-icon" :class="f.grad"><i class="bi" :class="f.icon"></i></span>
          <span class="launcher-label">{{ t(f.key) }}</span>
        </router-link>
      </div>
    </div>
  </div>
</template>
