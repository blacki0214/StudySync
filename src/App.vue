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
import { useUiStore } from './stores/uiStore.js'
import { usePaletteStore } from './stores/paletteStore.js'
import AppSidebar from './components/common/AppSidebar.vue'
import MobileHeader from './components/common/MobileHeader.vue'
import MobileTabBar from './components/common/MobileTabBar.vue'
import MobileMoreSheet from './components/common/MobileMoreSheet.vue'
import CommandPalette from './components/common/CommandPalette.vue'
import AppDialogs from './components/common/AppDialogs.vue'
import { SpeedInsights } from '@vercel/speed-insights/vue'

const route = useRoute()
const ui = useUiStore()
const palette = usePaletteStore()

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
  ui.initViewport()
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  ui.teardownViewport()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div v-if="route.meta.layout === 'blank'" class="blank-layout">
    <router-view v-slot="{ Component }">
      <transition name="page-fade" mode="out-in"><component :is="Component" /></transition>
    </router-view>
    <AppDialogs />
    <SpeedInsights />
  </div>

  <div v-else class="app-shell" :class="{ 'sidebar-mini': ui.sidebarMode === 'mini', 'is-mobile': ui.isMobile }">
    <!-- Desktop chrome: the fixed sidebar. Hidden entirely on phones, which use
         the dedicated app shell (top header + bottom tab bar) instead. -->
    <template v-if="!ui.isMobile">
      <AppSidebar />
      <div v-if="ui.sidebarOpen" class="sidebar-scrim" @click="ui.closeSidebar()"></div>
    </template>

    <!-- Mobile chrome: app-style contextual top header. -->
    <MobileHeader v-if="ui.isMobile" />

    <div class="app-main">
      <main class="app-content">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in"><component :is="Component" /></transition>
        </router-view>
      </main>
    </div>

    <!-- Mobile chrome: fixed bottom tab bar + slide-up More sheet. -->
    <template v-if="ui.isMobile">
      <MobileTabBar />
      <MobileMoreSheet />
    </template>

    <!-- Floating AI + help buttons (desktop only; mobile uses the tab bar). -->
    <div v-if="!ui.isMobile" class="floating-actions">
      <button class="fab-help" aria-label="Help">?</button>
      <button class="fab-ai" aria-label="AI assistant" @click="palette.show()"><i class="bi bi-stars"></i></button>
    </div>

    <!-- Global ⌘K command palette -->
    <CommandPalette />

    <!-- Global in-app toasts / confirm / prompt -->
    <AppDialogs />

    <!-- Vercel Speed Insights (real-user performance metrics in production) -->
    <SpeedInsights />
  </div>
</template>
