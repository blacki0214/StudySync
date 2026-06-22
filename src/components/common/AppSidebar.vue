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
import logoMark from '../../assets/images/logo_2.png'

const searchShortcut = shortcut('K')

const auth = useAuthStore()
const ui = useUiStore()
const palette = usePaletteStore()
const router = useRouter()
const { t, locale } = useI18n()

// Light (non-fill) icons for the calm Notion look.
const links = [
  { to: '/hub', icon: 'bi-house', key: 'nav.hub' },
  { to: '/my-subjects', icon: 'bi-folder', key: 'nav.mySubjects' },
  { to: '/subjects', icon: 'bi-journal-bookmark', key: 'nav.subjects' },
  { to: '/notes', icon: 'bi-file-earmark-text', key: 'nav.collabNotes', badge: 'live', badgeType: 'live' },
  { to: '/tasks', icon: 'bi-check2-square', key: 'nav.tasks' },
  { to: '/rooms', icon: 'bi-people', key: 'nav.studyRooms' },
  { to: '/flashcards', icon: 'bi-stars', key: 'nav.flashcards' },
  { to: '/community', icon: 'bi-chat-square-text', key: 'nav.community' },
  { to: '/classes', icon: 'bi-easel2', key: 'nav.classes' }
]

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
      <div class="sidebar-head-actions">
        <button v-if="ui.sidebarMode === 'mini'" class="sidebar-collapse-btn" :title="t('nav.expandSidebar')" :aria-label="t('nav.expandSidebar')" @click="ui.setSidebarMode('full')">
          <i class="bi bi-list"></i>
        </button>
        <button v-else class="sidebar-collapse-btn" :title="t('nav.minimizeSidebar')" :aria-label="t('nav.minimizeSidebar')" @click="ui.setSidebarMode('mini')">
          <i class="bi bi-chevron-double-left"></i>
        </button>
      </div>
    </div>

    <!-- Global search → command palette -->
    <button class="sidebar-search" @click="palette.show()">
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
        @click="ui.closeSidebar()"
      >
        <i class="bi" :class="link.icon"></i>
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

      <button class="sidebar-ctl" :aria-label="t('nav.notifications')" :title="t('nav.notifications')">
        <i class="bi bi-bell"></i><span class="notif-dot"></span>
      </button>
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
        <li><router-link class="dropdown-item" to="/profile" @click="ui.closeSidebar()"><i class="bi bi-person"></i>{{ t('nav.profile') }}</router-link></li>
        <li><hr class="dropdown-divider" /></li>
        <li><button class="dropdown-item text-danger" @click="logout"><i class="bi bi-box-arrow-right"></i>{{ t('nav.logout') }}</button></li>
      </ul>
    </div>
  </aside>
</template>
