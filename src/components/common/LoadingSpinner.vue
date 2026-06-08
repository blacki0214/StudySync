<script setup>
/** LoadingSpinner — simple centered spinner used while data loads. */
defineProps({
  label: { type: String, default: 'Loading...' }
})
</script>

<template>
  <div class="spinner-wrap">
    <div class="text-center">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">{{ label }}</span>
      </div>
      <div class="text-muted-sm mt-2">{{ label }}</div>
    </div>
  </div>
</template>
