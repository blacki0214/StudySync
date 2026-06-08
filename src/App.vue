<script setup>
/**
 * App.vue — top-level shell.
 *
 * Chooses between two layouts based on the active route's meta.layout:
 *   • 'blank'  -> landing / login / register (no sidebar)
 *   • default  -> the authenticated app shell (sidebar + navbar + footer)
 *
 * The mobile sidebar open/close state lives here and is passed down to the
 * navbar (toggle button) and sidebar (drawer).
 */
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from './components/common/AppSidebar.vue'
import AppNavbar from './components/common/AppNavbar.vue'
import AppFooter from './components/common/AppFooter.vue'

const route = useRoute()
const sidebarOpen = ref(false)
</script>

<template>
  <!-- Blank layout: full-bleed pages such as the landing and auth screens. -->
  <div v-if="route.meta.layout === 'blank'" class="blank-layout">
    <router-view v-slot="{ Component }">
      <transition name="page-fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>

  <!-- App shell: sidebar + navbar + routed content. -->
  <div v-else class="app-shell">
    <AppSidebar :open="sidebarOpen" @close="sidebarOpen = false" />
    <button
      v-if="sidebarOpen"
      class="sidebar-backdrop d-md-none"
      aria-label="Close menu"
      @click="sidebarOpen = false"
    ></button>

    <div class="app-main">
      <AppNavbar @toggle-sidebar="sidebarOpen = !sidebarOpen" />
      <main class="app-content">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
      <AppFooter />
    </div>
  </div>
</template>
