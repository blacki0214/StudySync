<script setup>
/**
 * SubjectIcon — the coloured subject tile. Renders, in priority order:
 *   1. an uploaded image  (icon is a data:/http URL)
 *   2. a Bootstrap icon    (icon is a 'bi-…' name)
 *   3. the letter badge     (fallback)
 * Keeps every subject surface (My Subjects, catalog, workspace) consistent.
 */
import { computed } from 'vue'

const props = defineProps({
  subject: { type: Object, default: () => ({}) },
  // Extra class on the tile so it matches each surface (sc-badge / ws-badge / sp-icon).
  tileClass: { type: String, default: 'sc-badge' }
})

const icon = computed(() => props.subject?.icon || '')
const isImage = computed(() => /^(data:|https?:)/.test(icon.value))
const isBiIcon = computed(() => icon.value.startsWith('bi-'))
</script>

<template>
  <span class="icon-tile" :class="[tileClass, subject.color]">
    <img v-if="isImage" :src="icon" :alt="subject.name || ''" class="subject-icon-img" />
    <i v-else-if="isBiIcon" class="bi subject-icon-bi" :class="icon"></i>
    <template v-else>{{ subject.letters }}</template>
  </span>
</template>

<style scoped>
.subject-icon-img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
/* Bootstrap icons default to 1rem, which looks lost in the tile. Scale relative
   to the tile's font-size so it fits big cards and small badges alike. */
.subject-icon-bi { font-size: 1.4em; line-height: 1; }
</style>
