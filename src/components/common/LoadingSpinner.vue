<script setup>
/** LoadingSpinner — simple centered spinner used while data loads. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({
  label: { type: String, default: '' }
})
// Fall back to the translated "Loading..." when no explicit label is given.
const text = computed(() => props.label || t('common.loading'))
</script>

<template>
  <div class="spinner-wrap">
    <div class="spinner-inner">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">{{ text }}</span>
      </div>
      <div class="spinner-label">{{ text }}</div>
    </div>
  </div>
</template>

<style scoped>
.spinner-inner { text-align: center; }
.spinner-label { color: var(--c-text-muted); font-size: 0.85rem; margin-top: var(--space-2); }
</style>
