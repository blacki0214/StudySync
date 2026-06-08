<script setup>
/** EmptyState — friendly placeholder for empty lists, with an optional action. */
defineProps({
  icon: { type: String, default: 'bi-inbox' },
  title: { type: String, default: 'Nothing here yet' },
  message: { type: String, default: '' }
})
</script>

<template>
  <div class="empty-state">
    <div class="empty-icon"><i class="bi" :class="icon"></i></div>
    <h5>{{ title }}</h5>
    <p v-if="message" class="text-muted-sm">{{ message }}</p>
    <!-- Slot lets callers drop in a call-to-action button. -->
    <slot />
  </div>
</template>
