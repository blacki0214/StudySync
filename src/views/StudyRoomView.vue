<script setup>
/**
 * StudyRoomView — a live study room. On enter we join the room's realtime
 * channel (presence + activity broadcast). The user can post activity which is
 * broadcast to everyone in the room.
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useStudyRoomStore } from '../stores/studyRoomStore.js'
import OnlineUsersPanel from '../components/study/OnlineUsersPanel.vue'
import ActivityFeed from '../components/study/ActivityFeed.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'

const route = useRoute()
const roomStore = useStudyRoomStore()
const { activeRoom, onlineUsers, activityFeed } = storeToRefs(roomStore)

const ready = ref(false)
const message = ref('')

onMounted(async () => {
  await roomStore.enterRoom(route.params.id)
  ready.value = true
})
onUnmounted(() => roomStore.leaveRoom())

function post() {
  if (!message.value.trim()) return
  roomStore.sendActivity(message.value.trim())
  message.value = ''
}
</script>

<template>
  <LoadingSpinner v-if="!ready" label="Joining study room..." />

  <div v-else-if="activeRoom">
    <div class="page-header">
      <router-link to="/dashboard" class="text-muted-sm"><i class="bi bi-arrow-left me-1"></i>Dashboard</router-link>
      <h1 class="mt-1 mb-1">
        <span class="badge-soft me-2">{{ activeRoom.subject?.code }}</span>{{ activeRoom.name }}
      </h1>
      <p>{{ activeRoom.description }}</p>
    </div>

    <div class="room-layout">
      <div>
        <!-- Shared "whiteboard" / broadcast composer -->
        <div class="panel mb-4">
          <div class="section-title"><i class="bi bi-megaphone"></i>Broadcast an update</div>
          <div class="input-group">
            <input
              v-model="message"
              class="form-control"
              placeholder="e.g. I just added a note on hash tables"
              @keyup.enter="post"
            />
            <button class="btn btn-brand" @click="post"><i class="bi bi-send me-1"></i>Send</button>
          </div>
          <p class="text-muted-sm mt-2 mb-0">
            Your message is broadcast to everyone in the room in real time (Supabase broadcast channel).
          </p>
        </div>

        <ActivityFeed :activities="activityFeed" />
      </div>

      <OnlineUsersPanel :users="onlineUsers" title="In this room" />
    </div>
  </div>
</template>
