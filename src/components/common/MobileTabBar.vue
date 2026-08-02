<script setup>
/**
 * MobileTabBar — the fixed bottom navigation for phones. Five study-focused
 * destinations (Home · Subjects · Notes · Tasks · More); everything else lives
 * in the More sheet. Active icons light up (outline → filled twin) like the
 * desktop sidebar. Sits above the home indicator via safe-area padding (CSS).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '../../stores/uiStore.js'
import { useAuthStore } from '../../stores/authStore.js'

const route = useRoute()
const ui = useUiStore()
const auth = useAuthStore()
const { t } = useI18n()

// Primary tabs adapt to the role; the rest live in the More sheet.
// `tour` is the data-tour hook the mobile product tour spotlights.
const studentTabs = [
  { to: '/hub', icon: 'bi-house', activeIcon: 'bi-house-fill', key: 'nav.hub', tour: 'm-tab-hub' },
  { to: '/my-subjects', icon: 'bi-grid', activeIcon: 'bi-grid-fill', key: 'mobile.tabSubjects', tour: 'm-tab-subjects' },
  { to: '/notes', icon: 'bi-file-earmark-text', activeIcon: 'bi-file-earmark-text-fill', key: 'nav.collabNotes', tour: 'm-tab-notes' },
  { to: '/tasks', icon: 'bi-check2-square', activeIcon: 'bi-check-square-fill', key: 'nav.tasks', tour: 'm-tab-tasks' }
]
const teacherTabs = [
  { to: '/teach', icon: 'bi-easel', activeIcon: 'bi-easel-fill', key: 'nav.teach', tour: 'm-tab-teach' },
  { to: '/classes', icon: 'bi-mortarboard', activeIcon: 'bi-mortarboard-fill', key: 'nav.classes', tour: 'm-tab-classes' },
  { to: '/notes', icon: 'bi-file-earmark-text', activeIcon: 'bi-file-earmark-text-fill', key: 'nav.collabNotes', tour: 'm-tab-notes' },
  { to: '/schedule', icon: 'bi-calendar-week', activeIcon: 'bi-calendar-week-fill', key: 'nav.schedule', tour: 'm-tab-schedule' }
]
const adminTabs = [
  { to: '/school', icon: 'bi-building', activeIcon: 'bi-building-fill', key: 'nav.school', tour: 'm-tab-school' },
  { to: '/classes', icon: 'bi-mortarboard', activeIcon: 'bi-mortarboard-fill', key: 'nav.classes', tour: 'm-tab-classes' },
  { to: '/community', icon: 'bi-chat-square-text', activeIcon: 'bi-chat-square-text-fill', key: 'nav.community', tour: 'm-tab-community' }
]
const tabs = computed(() => (auth.isAdmin ? adminTabs : auth.isTeacher ? teacherTabs : studentTabs))
</script>

<template>
  <nav class="m-tabbar" :aria-label="t('nav.workspace')">
    <router-link
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="m-tab"
      active-class="is-active"
      :data-tour="tab.tour"
      @click="ui.closeMore()"
    >
      <i class="bi m-tab-icon m-tab-icon-outline" :class="tab.icon"></i>
      <i class="bi m-tab-icon m-tab-icon-fill" :class="tab.activeIcon"></i>
      <span class="m-tab-label">{{ t(tab.key) }}</span>
    </router-link>

    <!-- More: opens the overflow bottom sheet. -->
    <button class="m-tab" data-tour="m-tab-more" :class="{ 'is-active': ui.moreSheetOpen }" @click="ui.toggleMore()">
      <i class="bi m-tab-icon m-tab-icon-outline bi-list"></i>
      <i class="bi m-tab-icon m-tab-icon-fill bi-list"></i>
      <span class="m-tab-label">{{ t('mobile.more') }}</span>
    </button>
  </nav>
</template>
