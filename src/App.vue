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
import AppNavbar from './components/common/AppNavbar.vue'
import CommandPalette from './components/common/CommandPalette.vue'

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
    <button
      v-if="ui.sidebarOpen"
      class="sidebar-backdrop d-md-none"
      aria-label="Close menu"
      @click="ui.closeSidebar()"
    ></button>

    <div class="app-main">
      <AppNavbar />
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
