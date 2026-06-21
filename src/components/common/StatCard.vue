<script setup>
/**
 * StatCard — the headline metric card used on Dashboard, Flashcards and Profile.
 * `delta` is optional sub-text (e.g. "+128 this week"); `deltaType` styles it.
 */
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  icon: { type: String, required: true },
  grad: { type: String, default: 'grad-blue' },
  delta: { type: String, default: '' },
  deltaType: { type: String, default: 'muted' } // 'up' | 'muted'
})
</script>

<template>
  <div class="stat-card">
    <div class="stat-top">
      <span class="stat-label">{{ label }}</span>
      <span class="stat-icon" :class="grad"><i class="bi" :class="icon"></i></span>
    </div>
    <div class="stat-value">{{ value }}</div>
    <div v-if="delta" class="stat-delta" :class="deltaType">{{ delta }}</div>
  </div>
</template>
