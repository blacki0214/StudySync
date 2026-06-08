<script setup>
/**
 * VersionHistory — lists prior saved snapshots of a note (from note_versions).
 * Clicking a version emits `restore` with its content so the parent can preview
 * or roll back.
 */
import { timeAgo } from '../../utils/formatDate.js'

defineProps({
  versions: { type: Array, default: () => [] }
})
defineEmits(['restore'])
</script>

<template>
  <div class="panel version-list">
    <div class="section-title"><i class="bi bi-clock-history"></i>Version history</div>

    <p v-if="!versions.length" class="text-muted-sm mb-0">
      No previous versions yet. Each save creates a snapshot here.
    </p>

    <div v-for="v in versions" :key="v.id" class="version-row">
      <span class="v-num">v{{ v.version_number }}</span>
      <span class="text-truncate" style="max-width: 120px">
        {{ v.content.slice(0, 40) }}…
      </span>
      <span class="v-meta">{{ timeAgo(v.created_at) }}</span>
      <button
        class="btn btn-sm btn-soft ms-2"
        title="Restore this version"
        @click="$emit('restore', v)"
      >
        <i class="bi bi-arrow-counterclockwise"></i>
      </button>
    </div>
  </div>
</template>
