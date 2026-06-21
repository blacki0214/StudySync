<script setup>
/**
 * AppNavbar — top bar: global search, language switcher, dark-mode toggle,
 * notifications, avatar. All visible text comes from the i18n catalog.
 */
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/authStore.js'
import { useUiStore } from '../../stores/uiStore.js'
import { usePaletteStore } from '../../stores/paletteStore.js'
import { SUPPORTED, setLocale } from '../../i18n/index.js'
import AppLauncher from './AppLauncher.vue'

const auth = useAuthStore()
const ui = useUiStore()
const palette = usePaletteStore()
const router = useRouter()
const { t, locale } = useI18n()

// The search box is a trigger for the global command palette (⌘K).
function openPalette(e) {
  e.target.blur()
  palette.show()
}
async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="app-navbar">
    <button class="navbar-toggle" :aria-label="t('nav.workspace')" @click="ui.toggleSidebar()">
      <i class="bi bi-list"></i>
    </button>

    <div class="navbar-search">
      <i class="bi bi-search search-ico"></i>
      <input
        type="search"
        readonly
        :placeholder="t('nav.searchPlaceholder')"
        @focus="openPalette"
        @click="palette.show()"
      />
      <span class="kbd">⌘K</span>
    </div>

    <div class="navbar-actions">
      <!-- Apps launcher (waffle grid) -->
      <AppLauncher />

      <!-- Language switcher -->
      <div class="dropdown">
        <button class="lang-switch" :aria-label="t('nav.language')" :title="t('nav.language')" data-bs-toggle="dropdown">
          <i class="bi bi-translate"></i>
          <span class="lang-current">{{ locale.toUpperCase() }}</span>
          <i class="bi bi-chevron-down lang-caret"></i>
        </button>
        <ul class="dropdown-menu dropdown-menu-end lang-menu">
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

      <button class="icon-btn" :aria-label="ui.isDark ? t('nav.lightMode') : t('nav.darkMode')" @click="ui.toggleTheme()">
        <i class="bi" :class="ui.isDark ? 'bi-sun' : 'bi-moon'"></i>
      </button>

      <button class="icon-btn" :aria-label="t('nav.notifications')">
        <i class="bi bi-bell"></i>
        <span class="notif-dot"></span>
      </button>

      <div class="dropdown">
        <img
          v-if="auth.user?.avatar_url"
          :src="auth.user.avatar_url"
          class="navbar-avatar"
          :alt="auth.displayName"
          data-bs-toggle="dropdown"
          role="button"
        />
        <ul class="dropdown-menu dropdown-menu-end">
          <li><router-link class="dropdown-item" to="/profile"><i class="bi bi-person"></i>{{ t('nav.profile') }}</router-link></li>
          <li><hr class="dropdown-divider" /></li>
          <li><button class="dropdown-item text-danger" @click="logout"><i class="bi bi-box-arrow-right"></i>{{ t('nav.logout') }}</button></li>
        </ul>
      </div>
    </div>
  </header>
</template>
