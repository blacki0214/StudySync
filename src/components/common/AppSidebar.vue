<script setup>
/**
 * AppSidebar — primary navigation, achievements XP card and the signed-in user
 * footer. Matches the Figma. Collapses to an off-canvas drawer on mobile via the
 * uiStore.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/authStore.js'
import { useUiStore } from '../../stores/uiStore.js'
import logoMark from '../../assets/images/logo-mark.png'

const auth = useAuthStore()
const ui = useUiStore()
const { t } = useI18n()

const links = [
  { to: '/hub', icon: 'bi-compass', key: 'nav.hub' },
  { to: '/subjects', icon: 'bi-journal-bookmark-fill', key: 'nav.subjects' },
  { to: '/notes', icon: 'bi-file-earmark-text', key: 'nav.collabNotes', badge: 'live', badgeType: 'live' },
  { to: '/rooms', icon: 'bi-people-fill', key: 'nav.studyRooms', badge: '3', badgeType: 'count' },
  { to: '/flashcards', icon: 'bi-stars', key: 'nav.flashcards' },
  { to: '/community', icon: 'bi-chat-square-text', key: 'nav.community' },
  { to: '/profile', icon: 'bi-person', key: 'nav.profile' }
]

const user = computed(() => auth.user || {})
const xpPct = computed(() => {
  if (!user.value.xp || !user.value.xpNext) return 0
  return Math.min((user.value.xp / user.value.xpNext) * 100, 100)
})

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
  <aside class="app-sidebar" :class="{ open: ui.sidebarOpen }">
    <div class="sidebar-brand">
      <img :src="logoMark" class="brand-mark" alt="StudySync logo" />
      <div>
        <div class="brand-name">StudySync</div>
        <div class="brand-sub">Vietnam</div>
      </div>
    </div>

    <div class="sidebar-section-label">{{ t('nav.workspace') }}</div>
    <nav class="sidebar-nav">
      <router-link
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="sidebar-link"
        @click="ui.closeSidebar()"
      >
        <i class="bi" :class="link.icon"></i>
        <span>{{ t(link.key) }}</span>
        <span v-if="link.badge" class="link-badge" :class="link.badgeType">
          {{ link.badgeType === 'live' ? t('nav.live') : link.badge }}
        </span>
      </router-link>
    </nav>

    <div class="sidebar-section-label">{{ t('nav.achievements') }}</div>
    <div class="xp-card">
      <div class="xp-trophy"><i class="bi bi-trophy-fill"></i></div>
      <div class="xp-title">{{ t('nav.levelScholar', { level: user.level || 1 }) }}</div>
      <div class="xp-meta">
        {{ (user.xp || 0).toLocaleString() }} / {{ (user.xpNext || 0).toLocaleString() }} XP
      </div>
      <div class="xp-bar"><div class="xp-fill" :style="{ width: xpPct + '%' }"></div></div>
    </div>

    <div class="sidebar-spacer"></div>

    <router-link to="/profile" class="sidebar-user" @click="ui.closeSidebar()">
      <span class="su-avatar">
        <img v-if="user.avatar_url" :src="user.avatar_url" :alt="user.full_name" />
        <span v-else class="avatar-img user-avatar">{{ initials(user.full_name) }}</span>
        <span class="su-dot"></span>
      </span>
      <div>
        <div class="su-name">{{ user.full_name }}</div>
        <div class="su-sub">{{ user.program || 'Student' }}</div>
      </div>
    </router-link>
  </aside>
</template>
