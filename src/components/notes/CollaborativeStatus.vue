<script setup>
/**
 * CollaborativeStatus — the live collaboration HUD shown in the editor toolbar.
 * Surfaces: save status pill, stacked avatars of online users, and a typing
 * indicator. All data comes straight from the noteStore's realtime state.
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useNoteStore } from '../../stores/noteStore.js'
import { useAuthStore } from '../../stores/authStore.js'

const noteStore = useNoteStore()
const auth = useAuthStore()
const { saveStatus, onlineUsers, typingUsers } = storeToRefs(noteStore)

const statusMeta = {
  idle: { icon: 'bi-cloud', text: 'Up to date' },
  saving: { icon: 'bi-arrow-repeat', text: 'Saving…' },
  saved: { icon: 'bi-check-circle', text: 'Saved' },
  conflict: { icon: 'bi-exclamation-triangle', text: 'Conflict' },
  error: { icon: 'bi-x-circle', text: 'Error' }
}
const current = computed(() => statusMeta[saveStatus.value] || statusMeta.idle)

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

// Names of OTHER people currently typing (exclude myself).
const othersTyping = computed(() =>
  onlineUsers.value
    .filter((u) => typingUsers.value.includes(u.id) && u.id !== auth.user?.id)
    .map((u) => u.full_name)
)
</script>

<template>
  <div class="collab-bar">
    <!-- Online collaborators -->
    <div v-if="onlineUsers.length" class="avatar-stack" :title="`${onlineUsers.length} online`">
      <span
        v-for="u in onlineUsers.slice(0, 4)"
        :key="u.id"
        class="mini-avatar"
        :title="u.full_name"
      >{{ initials(u.full_name) }}</span>
    </div>

    <!-- Save status -->
    <span class="save-status" :class="saveStatus">
      <i class="bi" :class="current.icon"></i>{{ current.text }}
    </span>
  </div>

  <!-- Typing indicator -->
  <div class="typing-indicator px-4" v-if="othersTyping.length">
    <span class="typing-dots"><span></span><span></span><span></span></span>
    {{ othersTyping.join(', ') }} {{ othersTyping.length > 1 ? 'are' : 'is' }} typing…
  </div>
</template>
