<script setup>
/** ActivityFeed — realtime stream of room activity (broadcast events). */
import { timeAgo } from '../../utils/formatDate.js'

defineProps({
  activities: { type: Array, default: () => [] }
})

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
  <div class="panel">
    <div class="section-title"><i class="bi bi-activity"></i>Live activity</div>

    <p v-if="!activities.length" class="text-muted-sm mb-0">
      Waiting for activity… actions from people in this room appear here in real time.
    </p>

    <div class="activity-feed">
      <div v-for="(a, i) in activities" :key="i" class="activity-item">
        <span class="act-avatar">{{ initials(a.fullName) }}</span>
        <div>
          <div><strong>{{ a.fullName }}</strong> {{ a.message }}</div>
          <div class="act-time">{{ timeAgo(a.at) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
