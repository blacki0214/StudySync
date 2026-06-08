<script setup>
/**
 * AppSidebar — primary navigation. Collapses into an off-canvas drawer on mobile
 * (controlled by the `open` prop from App.vue).
 */
defineProps({
  open: { type: Boolean, default: false }
})
defineEmits(['close'])

const links = [
  { to: '/dashboard', icon: 'bi-grid-1x2', label: 'Dashboard' },
  { to: '/subjects', icon: 'bi-journal-bookmark', label: 'Subjects' },
  { to: '/notes', icon: 'bi-sticky', label: 'Notes' },
  { to: '/flashcards', icon: 'bi-lightning-charge', label: 'Flashcards & Quiz' },
  { to: '/community', icon: 'bi-people', label: 'Community' },
  { to: '/profile', icon: 'bi-person-circle', label: 'Profile' }
]
</script>

<template>
  <aside class="app-sidebar" :class="{ open }">
    <div class="sidebar-brand">
      <span class="brand-mark"><i class="bi bi-mortarboard-fill"></i></span>
      StudySync
    </div>

    <nav class="sidebar-nav">
      <router-link
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="sidebar-link"
        @click="$emit('close')"
      >
        <i class="bi" :class="link.icon"></i>
        {{ link.label }}
      </router-link>
    </nav>

    <div class="sidebar-footer">
      StudySync Vietnam · COS30043
    </div>
  </aside>
</template>
