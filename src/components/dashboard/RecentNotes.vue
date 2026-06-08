<script setup>
/** RecentNotes — compact list of the most recently updated notes. */
import { timeAgo } from '../../utils/formatDate.js'

defineProps({
  notes: { type: Array, default: () => [] }
})
</script>

<template>
  <div class="panel">
    <div class="section-title">
      <i class="bi bi-clock"></i>Recent notes
      <router-link to="/notes" class="ms-auto text-muted-sm">View all</router-link>
    </div>

    <p v-if="!notes.length" class="text-muted-sm mb-0">No notes yet.</p>

    <router-link
      v-for="n in notes"
      :key="n.id"
      :to="`/notes/${n.id}`"
      class="subject-chip text-reset text-decoration-none"
    >
      <div>
        <div class="fw-semibold">{{ n.title }}</div>
        <div class="text-muted-sm">{{ timeAgo(n.updated_at) }} · v{{ n.version }}</div>
      </div>
      <i class="bi bi-chevron-right text-muted"></i>
    </router-link>
  </div>
</template>
