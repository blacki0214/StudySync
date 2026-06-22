<script setup>
/**
 * App.vue — top-level shell.
 *
 * Two layouts based on route meta.layout:
 *   • 'blank'  -> landing / login / register (no chrome)
 *   • default  -> the app shell (sidebar + top bar + content + floating actions)
 *
 * Theme is initialised once here so the saved light/dark choice applies before
 * the first paint of any page.
 */
import { onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useUiStore } from './stores/uiStore.js'
import { usePaletteStore } from './stores/paletteStore.js'
import AppSidebar from './components/common/AppSidebar.vue'
import CommandPalette from './components/common/CommandPalette.vue'
import logoMark from './assets/images/logo_2.png'

const route = useRoute()
const ui = useUiStore()
const palette = usePaletteStore()
const { t } = useI18n()

// Global ⌘K / Ctrl+K opens the command palette. Bound here (the always-mounted
// shell) so the listener has a single, clean add/remove lifecycle.
function onKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    palette.toggle()
  }
}

onMounted(() => {
  ui.initTheme()
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="route.meta.layout === 'blank'" class="blank-layout">
    <router-view v-slot="{ Component }">
      <transition name="page-fade" mode="out-in"><component :is="Component" /></transition>
    </router-view>
  </div>

  <div v-else class="app-shell">
    <AppSidebar />

    <!-- Mobile drawer scrim -->
    <div v-if="ui.sidebarOpen" class="sidebar-scrim" @click="ui.closeSidebar()"></div>

    <div class="app-main">
      <!-- Mobile-only top strip with the menu toggle (no desktop navbar). -->
      <div class="mobile-bar">
        <button class="mobile-menu-btn" :aria-label="t('nav.allFeatures')" @click="ui.toggleSidebar()">
          <i class="bi bi-list"></i>
        </button>
        <router-link to="/hub" class="mobile-brand">
          <img :src="logoMark" alt="StudySync" />
          <span>StudySync</span>
        </router-link>
        <button class="mobile-menu-btn" :aria-label="t('nav.searchPlaceholder')" @click="palette.show()">
          <i class="bi bi-search"></i>
        </button>
      </div>

      <main class="app-content">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in"><component :is="Component" /></transition>
        </router-view>
      </main>
    </div>

    <!-- Floating AI + help buttons (bottom-right in every mockup). -->
    <div class="floating-actions">
      <button class="fab-help" aria-label="Help">?</button>
      <button class="fab-ai" aria-label="AI assistant" @click="palette.show()"><i class="bi bi-stars"></i></button>
    </div>

    <!-- Global ⌘K command palette -->
    <CommandPalette />
  </div>
</template>
