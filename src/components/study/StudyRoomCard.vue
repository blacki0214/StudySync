<script setup>
/** StudyRoomCard — preview of a study room in the rooms grid. */
defineProps({
  room: { type: Object, required: true }
})
</script>

<template>
  <div class="room-card">
    <div class="d-flex justify-content-between align-items-start">
      <span class="badge-soft">{{ room.subject?.code || 'General' }}</span>
      <span class="room-active"><span class="dot-online"></span>{{ room.active_users }} active</span>
    </div>
    <div class="room-name mt-3">{{ room.name }}</div>
    <p class="room-desc">{{ room.description }}</p>
    <router-link :to="`/rooms/${room.id}`" class="btn btn-brand">
      <i class="bi bi-box-arrow-in-right me-1"></i> Join room
    </router-link>
  </div>
</template>
