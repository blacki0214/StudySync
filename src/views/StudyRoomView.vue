<script setup>
/**
 * StudyRoomView — the live study room. Presence (who's here), the live activity
 * feed and group chat are REAL: they run over a Supabase Realtime channel via
 * studyRoomStore (with a simulated channel in demo mode). No camera/WebRTC —
 * the tiles show avatars, and the call controls toggle local mic/camera state
 * and broadcast an activity line so the room reacts.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useContentStore } from '../stores/contentStore.js'
import { useStudyRoomStore } from '../stores/studyRoomStore.js'
import { useAuthStore } from '../stores/authStore.js'
import { isSupabaseConfigured } from '../services/supabaseClient.js'
import { roomResources } from '../data/sampleRooms.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const content = useContentStore()
const rooms = useStudyRoomStore()
const auth = useAuthStore()

const room = computed(() => content.rooms.find((r) => r.id === route.params.id) || content.rooms[0])
const subject = computed(() => content.subjectById(room.value?.subject_id))

// Live data from the room channel.
const online = computed(() => rooms.onlineUsers)
const activity = computed(() => rooms.activityFeed)
const messages = computed(() => rooms.messages)
// Shared resources have no backing table yet — show the seeded set in demo only.
const resources = isSupabaseConfigured ? [] : roomResources

const draft = ref('')
const micOn = ref(true)
const cameraOn = ref(false)
const meId = computed(() => auth.user?.id || 'anon')

// --- Functional Pomodoro countdown (starts at 25:00) ---
const seconds = ref(25 * 60)
let timer = null
const pomodoro = computed(() => {
  const m = Math.floor(seconds.value / 60)
  const s = seconds.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

onMounted(async () => {
  await content.ensureLoaded()
  await rooms.enterRoom(route.params.id)
  timer = setInterval(() => {
    if (seconds.value > 0) seconds.value--
  }, 1000)
})
onUnmounted(() => {
  clearInterval(timer)
  rooms.leaveRoom()
})

function send() {
  const text = draft.value.trim()
  if (!text) return
  rooms.sendChat(text)
  draft.value = ''
}

function toggleMic() {
  micOn.value = !micOn.value
  rooms.sendActivity(micOn.value ? 'unmuted' : 'muted their mic')
}
function toggleCamera() {
  cameraOn.value = !cameraOn.value
  rooms.sendActivity(cameraOn.value ? 'turned their camera on' : 'turned their camera off')
}
function react(emoji) {
  rooms.sendActivity(`reacted ${emoji}`)
}
function leave() {
  rooms.leaveRoom()
  router.push('/rooms')
}

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
// A short "HH:MM" clock time from an ISO string, for chat + activity.
function clock(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
</script>

<template>
  <div v-if="room">
    <!-- Header -->
    <div class="room-top">
      <div>
        <div class="rt-crumb">
          <router-link v-if="subject" :to="{ name: 'subject-hub', params: { id: subject.id } }" class="crumb-link">{{ subject.code }}</router-link>
          <template v-else>{{ room.code }}</template>
        </div>
        <div class="rt-titlerow">
          <h2 class="rt-title">{{ room.name }}</h2>
          <span class="rec-badge"><span class="rec-dot"></span>{{ t('rooms.recLive') }}</span>
          <span class="rt-students"><i class="bi bi-people"></i>{{ t('rooms.studentsCount', { n: online.length }) }}</span>
        </div>
      </div>
      <div class="pomodoro">
        <div class="pm-label"><i class="bi bi-stopwatch"></i>{{ t('rooms.pomodoro') }}</div>
        <div class="pm-time">{{ pomodoro }}</div>
      </div>
    </div>

    <div class="room-layout">
      <!-- Video stage -->
      <div class="video-stage">
        <div v-if="online.length" class="video-grid">
          <div
            v-for="p in online"
            :key="p.id"
            class="video-tile"
            :class="{ speaking: p.id === meId && micOn }"
          >
            <span class="tile-initials">{{ initials(p.full_name) }}</span>
            <span class="tile-name">{{ p.full_name }}<template v-if="p.id === meId"> ({{ t('rooms.you') }})</template></span>
            <span v-if="p.id === meId && !micOn" class="tile-mute"><i class="bi bi-mic-mute-fill"></i></span>
          </div>
        </div>
        <div v-else class="video-empty">
          <i class="bi bi-camera-video-off"></i>
          <p>{{ t('rooms.connecting') }}</p>
        </div>

        <!-- Call controls -->
        <div class="call-controls">
          <button class="cc-btn" :class="{ off: !micOn }" :title="t('rooms.mute')" @click="toggleMic">
            <i class="bi" :class="micOn ? 'bi-mic-fill' : 'bi-mic-mute-fill'"></i>
          </button>
          <button class="cc-btn" :class="{ off: !cameraOn }" :title="t('rooms.camera')" @click="toggleCamera">
            <i class="bi" :class="cameraOn ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'"></i>
          </button>
          <button class="cc-btn primary" :title="t('rooms.react')" @click="react('👍')"><i class="bi bi-emoji-smile"></i></button>
          <button class="cc-btn" :title="t('rooms.react')" @click="react('🎉')"><i class="bi bi-stars"></i></button>
          <button class="cc-btn danger" :title="t('rooms.leave')" @click="leave"><i class="bi bi-telephone-x-fill"></i></button>
        </div>
      </div>

      <!-- Right rail -->
      <div class="room-rail">
        <div class="panel">
          <div class="rail-label"><i class="bi bi-activity"></i>{{ t('rooms.liveActivity') }}</div>
          <p v-if="!activity.length" class="rail-empty">{{ t('rooms.noActivity') }}</p>
          <div v-for="(a, i) in activity" :key="i" class="activity-line">
            <span class="al-dot"></span>
            <span><strong>{{ (a.fullName || '').split(' ')[0] }}</strong> {{ a.message }}</span>
            <span class="al-time">{{ clock(a.at) }}</span>
          </div>
        </div>

        <div class="panel">
          <div class="rail-label"><i class="bi bi-folder2-open"></i>{{ t('rooms.sharedResources') }}</div>
          <p v-if="!resources.length" class="rail-empty">{{ t('rooms.noResources') }}</p>
          <div v-for="(r, i) in resources" :key="i" class="resource-row">
            <span class="rr-icon"><i class="bi" :class="r.icon"></i></span>
            <div>
              <div class="rr-name">{{ r.name }}</div>
              <div class="rr-size">{{ r.size }}</div>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="rail-label"><i class="bi bi-chat-dots"></i>{{ t('rooms.groupChat') }}</div>
          <div class="chat-scroll">
            <p v-if="!messages.length" class="rail-empty">{{ t('rooms.noMessages') }}</p>
            <div v-for="(m, i) in messages" :key="i" class="chat-msg" :class="{ me: m.userId === meId }">
              <span class="cm-avatar">{{ initials(m.fullName) }}</span>
              <div class="cm-body">
                <div class="cm-meta">{{ (m.fullName || '').split(' ')[0] }} · {{ clock(m.at) }}</div>
                <div class="cm-bubble">{{ m.text }}</div>
              </div>
            </div>
          </div>
          <div class="chat-input">
            <input v-model="draft" :placeholder="t('rooms.messageRoom')" @keyup.enter="send" />
            <button class="btn btn-brand btn-sm" @click="send"><i class="bi bi-send"></i></button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
