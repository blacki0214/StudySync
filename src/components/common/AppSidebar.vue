<script setup>
/**
 * AppSidebar — the single control surface for the whole app (Notion-style).
 * Replaces the old top navbar: it holds the brand, global search (⌘K), grouped
 * navigation, the achievements card, and a footer with theme/language/
 * notifications plus the account menu. Collapses to an off-canvas drawer on
 * mobile via the uiStore.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/authStore.js'
import { useUiStore } from '../../stores/uiStore.js'
import { usePaletteStore } from '../../stores/paletteStore.js'
import { SUPPORTED, setLocale } from '../../i18n/index.js'
import { shortcut } from '../../utils/platform.js'
import NotificationBell from './NotificationBell.vue'
import logoMark from '../../assets/images/logo_2.png'

const searchShortcut = shortcut('K')

const auth = useAuthStore()
const ui = useUiStore()
const palette = usePaletteStore()
const router = useRouter()
const { t, locale } = useI18n()

// Instagram-style nav: an outline icon by default, its filled twin when active
// (the icon "lights up" instead of the item getting a boxed background).
// The nav adapts to the signed-in role: students study, teachers teach, admins
// run a school. Teachers/admins still reach personal features via the account
// menu + direct routes — this is just the primary rail.
// `tour` is the data-tour hook the product tour spotlights (see tourStore).
const studentLinks = [
  { to: '/hub', icon: 'bi-house', activeIcon: 'bi-house-fill', key: 'nav.hub', tour: 'nav-hub' },
  { to: '/my-subjects', icon: 'bi-folder', activeIcon: 'bi-folder-fill', key: 'nav.mySubjects', tour: 'nav-my-subjects' },
  { to: '/subjects', icon: 'bi-journal-bookmark', activeIcon: 'bi-journal-bookmark-fill', key: 'nav.subjects' },
  { to: '/notes', icon: 'bi-file-earmark-text', activeIcon: 'bi-file-earmark-text-fill', key: 'nav.collabNotes', tour: 'nav-notes' },
  { to: '/tasks', icon: 'bi-check2-square', activeIcon: 'bi-check-square-fill', key: 'nav.tasks', tour: 'nav-tasks' },
  { to: '/schedule', icon: 'bi-calendar-week', activeIcon: 'bi-calendar-week-fill', key: 'nav.schedule', tour: 'nav-schedule' },
  { to: '/rooms', icon: 'bi-people', activeIcon: 'bi-people-fill', key: 'nav.studyRooms', tour: 'nav-rooms' },
  { to: '/flashcards', icon: 'bi-stars', activeIcon: 'bi-stars', key: 'nav.flashcards', tour: 'nav-flashcards' },
  { to: '/community', icon: 'bi-chat-square-text', activeIcon: 'bi-chat-square-text-fill', key: 'nav.community', tour: 'nav-community' },
  { to: '/classes', icon: 'bi-easel2', activeIcon: 'bi-easel2-fill', key: 'nav.classes', tour: 'nav-classes' }
]
const teacherLinks = [
  { to: '/teach', icon: 'bi-easel', activeIcon: 'bi-easel-fill', key: 'nav.teach', tour: 'nav-teach' },
  { to: '/classes', icon: 'bi-mortarboard', activeIcon: 'bi-mortarboard-fill', key: 'nav.classes', tour: 'nav-classes' },
  { to: '/notes', icon: 'bi-file-earmark-text', activeIcon: 'bi-file-earmark-text-fill', key: 'nav.collabNotes', tour: 'nav-notes' },
  { to: '/schedule', icon: 'bi-calendar-week', activeIcon: 'bi-calendar-week-fill', key: 'nav.schedule', tour: 'nav-schedule' },
  { to: '/rooms', icon: 'bi-people', activeIcon: 'bi-people-fill', key: 'nav.studyRooms', tour: 'nav-rooms' },
  { to: '/community', icon: 'bi-chat-square-text', activeIcon: 'bi-chat-square-text-fill', key: 'nav.community', tour: 'nav-community' },
  { to: '/flashcards', icon: 'bi-stars', activeIcon: 'bi-stars', key: 'nav.flashcards', tour: 'nav-flashcards' }
]
const adminLinks = [
  { to: '/school', icon: 'bi-building', activeIcon: 'bi-building-fill', key: 'nav.school', tour: 'nav-school' },
  { to: '/classes', icon: 'bi-mortarboard', activeIcon: 'bi-mortarboard-fill', key: 'nav.classes', tour: 'nav-classes' },
  { to: '/community', icon: 'bi-chat-square-text', activeIcon: 'bi-chat-square-text-fill', key: 'nav.community', tour: 'nav-community' },
  { to: '/settings', icon: 'bi-gear', activeIcon: 'bi-gear-fill', key: 'nav.settings', tour: 'nav-settings' }
]
const links = computed(() => (auth.isAdmin ? adminLinks : auth.isTeacher ? teacherLinks : studentLinks))

const user = computed(() => auth.user || {})

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <aside class="app-sidebar" :class="{ open: ui.sidebarOpen }">
    <div class="sidebar-head">
      <router-link to="/hub" class="sidebar-brand" @click="ui.closeSidebar()">
        <img :src="logoMark" class="brand-mark" alt="StudySync logo" />
        <div class="sidebar-brand-text">
          <div class="brand-name">StudySync</div>
          <div class="brand-sub">Vietnam</div>
        </div>
      </router-link>
    </div>

    <!-- Global search → command palette -->
    <button class="sidebar-search" data-tour="search" @click="palette.show()">
      <i class="bi bi-search"></i>
      <span>{{ t('nav.search') }}</span>
      <span class="kbd">{{ searchShortcut }}</span>
    </button>

    <div class="sidebar-section-label">{{ t('nav.workspace') }}</div>
    <nav class="sidebar-nav">
      <router-link
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="sidebar-link"
        :data-tour="link.tour"
        @click="ui.closeSidebar()"
      >
        <i class="bi link-icon link-icon-outline" :class="link.icon"></i>
        <i class="bi link-icon link-icon-fill" :class="link.activeIcon"></i>
        <span>{{ t(link.key) }}</span>
        <span v-if="link.badge" class="link-badge" :class="link.badgeType">
          {{ link.badgeType === 'live' ? t('nav.live') : link.badge }}
        </span>
      </router-link>
    </nav>

    <!-- Footer controls: theme · language · notifications -->
    <div class="sidebar-controls">
      <button class="sidebar-ctl" :aria-label="ui.isDark ? t('nav.lightMode') : t('nav.darkMode')" :title="ui.isDark ? t('nav.lightMode') : t('nav.darkMode')" @click="ui.toggleTheme()">
        <i class="bi" :class="ui.isDark ? 'bi-sun' : 'bi-moon'"></i>
      </button>

      <div class="dropdown dropup">
        <button class="sidebar-ctl" :aria-label="t('nav.language')" :title="t('nav.language')" data-bs-toggle="dropdown">
          <i class="bi bi-translate"></i><span class="ctl-lang">{{ locale.toUpperCase() }}</span>
        </button>
        <ul class="dropdown-menu lang-menu">
          <li class="lang-menu-head">{{ t('nav.language') }}</li>
          <li v-for="l in SUPPORTED" :key="l.code">
            <button class="lang-option" :class="{ 'is-active': locale === l.code }" @click="setLocale(l.code)">
              <span class="lang-opt-short">{{ l.short }}</span>
              <span class="lang-opt-label">{{ l.label }}</span>
              <i v-if="locale === l.code" class="bi bi-check2 lang-opt-check"></i>
            </button>
          </li>
        </ul>
      </div>

      <NotificationBell />
    </div>

    <!-- Account -->
    <div class="dropdown dropup sidebar-account">
      <button class="sidebar-user" data-bs-toggle="dropdown" :aria-label="auth.displayName">
        <span class="su-avatar">
          <img v-if="user.avatar_url" :src="user.avatar_url" :alt="user.full_name" />
          <span v-else class="avatar-img user-avatar">{{ initials(user.full_name) }}</span>
        </span>
        <div class="su-meta">
          <div class="su-name">{{ user.full_name || t('editor.someone') }}</div>
          <div class="su-sub">{{ user.program || 'Student' }}</div>
        </div>
        <i class="bi bi-chevron-expand su-caret"></i>
      </button>
      <ul class="dropdown-menu profile-menu">
        <li><router-link class="dropdown-item" to="/settings" @click="ui.closeSidebar()"><i class="bi bi-gear"></i>{{ t('nav.settings') }}</router-link></li>
        <li><hr class="dropdown-divider" /></li>
        <li><button class="dropdown-item text-danger" @click="logout"><i class="bi bi-box-arrow-right"></i>{{ t('nav.logout') }}</button></li>
      </ul>
    </div>
  </aside>
</template>
