<script setup>
/**
 * MobileMoreSheet — the slide-up bottom sheet behind the "More" tab. Holds the
 * destinations that don't fit the 5-slot tab bar (Explore), the appearance /
 * language preferences, quick access to Settings, and log out. Opens from
 * uiStore.moreSheetOpen; closes on scrim tap, Escape, or picking an item.
 */
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/authStore.js'
import { useUiStore } from '../../stores/uiStore.js'
import { SUPPORTED, setLocale } from '../../i18n/index.js'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()
const { t, locale } = useI18n()

const user = computed(() => auth.user || {})

// Overflow destinations (everything not in the bottom tab bar).
const explore = [
  { to: '/subjects', icon: 'bi-journal-bookmark', key: 'mobile.allSubjects' },
  { to: '/schedule', icon: 'bi-calendar-week', key: 'nav.schedule' },
  { to: '/rooms', icon: 'bi-people', key: 'nav.studyRooms' },
  { to: '/flashcards', icon: 'bi-stars', key: 'nav.flashcards' },
  { to: '/community', icon: 'bi-chat-square-text', key: 'nav.community' },
  { to: '/classes', icon: 'bi-easel2', key: 'nav.classes' }
]

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
async function logout() {
  ui.closeMore()
  await auth.logout()
  router.push({ name: 'login' })
}

function onKey(e) {
  if (ui.moreSheetOpen && e.key === 'Escape') ui.closeMore()
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <transition name="m-sheet">
    <div v-if="ui.moreSheetOpen" class="m-sheet-root">
      <div class="m-sheet-scrim" @click="ui.closeMore()"></div>

      <div class="m-sheet-panel" role="dialog" :aria-label="t('mobile.more')">
        <div class="m-sheet-grab"></div>

        <!-- Account -->
        <router-link to="/settings" class="m-sheet-account" @click="ui.closeMore()">
          <span class="m-sheet-avatar">
            <img v-if="user.avatar_url" :src="user.avatar_url" :alt="user.full_name" />
            <span v-else class="avatar-img">{{ initials(user.full_name) }}</span>
          </span>
          <span class="m-sheet-account-meta">
            <span class="m-sheet-name">{{ user.full_name || t('editor.someone') }}</span>
            <span class="m-sheet-sub">{{ user.program || 'Student' }}</span>
          </span>
          <i class="bi bi-gear m-sheet-account-gear"></i>
        </router-link>

        <!-- Explore (overflow nav) -->
        <div class="m-sheet-label">{{ t('mobile.explore') }}</div>
        <div class="m-sheet-grid">
          <router-link
            v-for="item in explore"
            :key="item.to"
            :to="item.to"
            class="m-sheet-item"
            @click="ui.closeMore()"
          >
            <i class="bi" :class="item.icon"></i>
            <span>{{ t(item.key) }}</span>
          </router-link>
        </div>

        <!-- Preferences -->
        <div class="m-sheet-label">{{ t('mobile.preferences') }}</div>
        <div class="m-sheet-prefs">
          <button class="m-pref-row" @click="ui.toggleTheme()">
            <i class="bi" :class="ui.isDark ? 'bi-sun' : 'bi-moon'"></i>
            <span>{{ ui.isDark ? t('nav.lightMode') : t('nav.darkMode') }}</span>
          </button>

          <div class="m-pref-row m-pref-lang">
            <i class="bi bi-translate"></i>
            <span>{{ t('nav.language') }}</span>
            <span class="m-lang-pills">
              <button
                v-for="l in SUPPORTED"
                :key="l.code"
                class="m-lang-pill"
                :class="{ 'is-active': locale === l.code }"
                @click="setLocale(l.code)"
              >{{ l.short }}</button>
            </span>
          </div>
        </div>

        <button class="m-sheet-logout" @click="logout">
          <i class="bi bi-box-arrow-right"></i>{{ t('nav.logout') }}
        </button>
      </div>
    </div>
  </transition>
</template>
