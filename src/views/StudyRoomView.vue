<script setup>
/**
 * StudyRoomView — a Discord-style study room: a channel rail (text + voice
 * channels), the active text channel's live chat, and a member list. Chat and
 * presence are REAL over a Supabase Realtime channel via studyRoomStore (a
 * simulated channel in demo mode). Voice channels are presence-based (who's in
 * them) with mic/camera state — no real WebRTC audio.
 */
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useContentStore } from '../stores/contentStore.js'
import { useStudyRoomStore } from '../stores/studyRoomStore.js'
import { useAuthStore } from '../stores/authStore.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const content = useContentStore()
const rooms = useStudyRoomStore()
const auth = useAuthStore()

// Friendly default channel set (client-side — no schema needed).
const TEXT_CHANNELS = [
  { id: 'general', name: 'general' },
  { id: 'questions', name: 'questions' },
  { id: 'resources', name: 'resources' },
  { id: 'off-topic', name: 'off-topic' }
]
const VOICE_CHANNELS = [
  { id: 'voice-study', name: 'Study Hall' },
  { id: 'voice-focus', name: 'Focus Room' }
]

const room = computed(() => content.rooms.find((r) => r.id === route.params.id) || content.rooms[0])
const subject = computed(() => content.subjectById(room.value?.subject_id))

const activeText = ref('general')
const draft = ref('')
const micOn = ref(true)
const cameraOn = ref(false)
const scroller = ref(null)

const meId = computed(() => auth.user?.id || 'anon')
const online = computed(() => rooms.onlineUsers)
const myVoice = computed(() => rooms.myVoice)
const channelMsgs = computed(() => rooms.channelMessages(activeText.value))
const activeChannelName = computed(() => TEXT_CHANNELS.find((c) => c.id === activeText.value)?.name || 'general')
const voiceMembers = (id) => rooms.voiceMembers(id)
const connectedVoiceName = computed(() => VOICE_CHANNELS.find((c) => c.id === myVoice.value)?.name || '')

// --- Pomodoro (local) ---
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
  timer = setInterval(() => { if (seconds.value > 0) seconds.value-- }, 1000)
})
onUnmounted(() => {
  clearInterval(timer)
  rooms.leaveRoom()
})

// Auto-scroll chat to the newest message.
watch(() => channelMsgs.value.length, async () => {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
})

function send() {
  const text = draft.value.trim()
  if (!text) return
  rooms.sendChat(text, activeText.value)
  draft.value = ''
}
function toggleVoice(id) {
  if (myVoice.value === id) {
    rooms.setVoice(null)
  } else {
    rooms.setVoice(id)
    rooms.sendActivity(`joined ${VOICE_CHANNELS.find((c) => c.id === id)?.name} voice`)
  }
}
function leaveVoice() { rooms.setVoice(null) }
function toggleMic() { micOn.value = !micOn.value }
function toggleCamera() { cameraOn.value = !cameraOn.value }
function leaveRoom() {
  rooms.leaveRoom()
  router.push('/rooms')
}

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
function clock(isoStr) {
  try { return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}
</script>

<template>
  <div v-if="room" class="dc-room">
    <!-- Channel rail -->
    <aside class="dc-rail">
      <div class="dc-rail-head">
        <router-link to="/rooms" class="dc-back" :title="t('rooms.leave')"><i class="bi bi-chevron-left"></i></router-link>
        <div class="dc-room-name">{{ room.name }}</div>
      </div>
      <div v-if="subject" class="dc-room-sub">{{ subject.code }}</div>

      <div class="dc-section">{{ t('rooms.textChannels') }}</div>
      <button
        v-for="c in TEXT_CHANNELS"
        :key="c.id"
        class="dc-channel"
        :class="{ active: activeText === c.id }"
        @click="activeText = c.id"
      >
        <i class="bi bi-hash"></i><span>{{ c.name }}</span>
      </button>

      <div class="dc-section">{{ t('rooms.voiceChannels') }}</div>
      <div v-for="c in VOICE_CHANNELS" :key="c.id" class="dc-voice-group">
        <button class="dc-channel" :class="{ active: myVoice === c.id }" @click="toggleVoice(c.id)">
          <i class="bi bi-volume-up"></i><span>{{ c.name }}</span>
          <span v-if="voiceMembers(c.id).length" class="dc-vcount">{{ voiceMembers(c.id).length }}</span>
        </button>
        <div v-for="m in voiceMembers(c.id)" :key="m.id" class="dc-voice-member">
          <span class="dc-mini-av">{{ initials(m.full_name) }}</span>
          <span class="dc-vm-name">{{ m.full_name }}<template v-if="m.id === meId"> ({{ t('rooms.you') }})</template></span>
          <i class="bi bi-mic-fill dc-vm-mic"></i>
        </div>
      </div>

      <!-- Voice-connected bar -->
      <div v-if="myVoice" class="dc-voicebar">
        <div class="dc-vb-info">
          <i class="bi bi-broadcast dc-vb-live"></i>
          <div>
            <div class="dc-vb-status">{{ t('rooms.voiceConnected') }}</div>
            <div class="dc-vb-name">{{ connectedVoiceName }}</div>
          </div>
        </div>
        <div class="dc-vb-controls">
          <button class="dc-vb-btn" :class="{ off: !micOn }" :title="t('rooms.mute')" @click="toggleMic"><i class="bi" :class="micOn ? 'bi-mic-fill' : 'bi-mic-mute-fill'"></i></button>
          <button class="dc-vb-btn" :class="{ off: !cameraOn }" :title="t('rooms.camera')" @click="toggleCamera"><i class="bi" :class="cameraOn ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'"></i></button>
          <button class="dc-vb-btn danger" :title="t('rooms.disconnect')" @click="leaveVoice"><i class="bi bi-telephone-x-fill"></i></button>
        </div>
      </div>
    </aside>

    <!-- Main: active text channel -->
    <main class="dc-main">
      <header class="dc-main-head">
        <div class="dc-ch-title"><i class="bi bi-hash"></i>{{ activeChannelName }}</div>
        <div class="dc-head-right">
          <span class="dc-pomodoro"><i class="bi bi-stopwatch"></i>{{ pomodoro }}</span>
          <button class="btn btn-outline-soft btn-sm dc-leave" @click="leaveRoom"><i class="bi bi-box-arrow-right"></i>{{ t('rooms.leave') }}</button>
        </div>
      </header>

      <div ref="scroller" class="dc-messages">
        <div v-if="!channelMsgs.length" class="dc-ch-empty">
          <i class="bi bi-hash"></i>
          <p>{{ t('rooms.channelEmpty', { channel: activeChannelName }) }}</p>
        </div>
        <div v-for="(m, i) in channelMsgs" :key="i" class="dc-msg">
          <span class="dc-msg-av">{{ initials(m.fullName) }}</span>
          <div class="dc-msg-body">
            <div class="dc-msg-meta"><span class="dc-msg-name">{{ m.fullName }}</span><span class="dc-msg-time">{{ clock(m.at) }}</span></div>
            <div class="dc-msg-text">{{ m.text }}</div>
          </div>
        </div>
      </div>

      <div class="dc-composer">
        <input v-model="draft" :placeholder="t('rooms.messageChannel', { channel: activeChannelName })" @keyup.enter="send" />
        <button class="dc-send" :disabled="!draft.trim()" @click="send"><i class="bi bi-send-fill"></i></button>
      </div>
    </main>

    <!-- Members -->
    <aside class="dc-members">
      <div class="dc-section">{{ t('rooms.members', { n: online.length }) }}</div>
      <div v-for="m in online" :key="m.id" class="dc-member">
        <span class="dc-mem-av">{{ initials(m.full_name) }}<span class="dc-presence"></span></span>
        <span class="dc-mem-name">{{ m.full_name }}<template v-if="m.id === meId"> ({{ t('rooms.you') }})</template></span>
        <i v-if="m.voice" class="bi bi-volume-up-fill dc-mem-voice" :title="t('rooms.voiceChannels')"></i>
      </div>
    </aside>
  </div>
</template>
