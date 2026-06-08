<script setup>
/**
 * OnlineUsersPanel — live presence list. Reused by both the study room and the
 * collaborative editor (any place that has an `users` array of presence rows).
 */
import { timeAgo } from '../../utils/formatDate.js'

defineProps({
  users: { type: Array, default: () => [] },
  title: { type: String, default: 'Online now' }
})

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
  <div class="panel online-users-panel">
    <div class="section-title">
      <i class="bi bi-broadcast"></i>{{ title }}
      <span class="badge-soft ms-auto">{{ users.length }}</span>
    </div>

    <p v-if="!users.length" class="text-muted-sm mb-0">No one is here yet.</p>

    <div v-for="u in users" :key="u.id" class="user-row">
      <span class="user-avatar" style="width:30px;height:30px;font-size:0.72rem">
        {{ initials(u.full_name) }}
      </span>
      <span>{{ u.full_name }}</span>
      <span class="ms-auto text-muted-sm">
        <span class="dot-online me-1"></span>
        <template v-if="u.online_at">{{ timeAgo(u.online_at) }}</template>
        <template v-else>online</template>
      </span>
    </div>
  </div>
</template>
