<script setup>
/**
 * StudyRoomView — the live study room (visual mock of a video call, matching the
 * Figma). Video tiles use portraits/avatars; the Pomodoro timer counts down for
 * real and the group chat is interactive. No camera/WebRTC is used.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { isSupabaseConfigured } from '../services/supabaseClient.js'
import { useContentStore } from '../stores/contentStore.js'
import {
  roomParticipants,
  roomActivity,
  roomResources,
  roomChat
} from '../data/sampleRooms.js'

const route = useRoute()
const { t } = useI18n()
const content = useContentStore()
const room = computed(() => content.rooms.find((r) => r.id === route.params.id) || content.rooms[0])
const subject = computed(() => content.subjectById(room.value?.subject_id))

// The live call (video tiles, presence, chat, shared files) is a visual mock with
// no backing table. With a real backend connected we show nothing rather than
// fake people; in demo mode we keep the seeded call so the page looks alive.
const participants = isSupabaseConfigured ? [] : roomParticipants
const activity = isSupabaseConfigured ? [] : roomActivity
const resources = isSupabaseConfigured ? [] : roomResources
const messages = ref(isSupabaseConfigured ? [] : [...roomChat])
const draft = ref('')

// --- Functional Pomodoro countdown (starts at 18:42 like the mockup) ---
const seconds = ref(18 * 60 + 42)
let timer = null
const pomodoro = computed(() => {
  const m = Math.floor(seconds.value / 60)
  const s = seconds.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

onMounted(() => {
  content.ensureLoaded()
  timer = setInterval(() => {
    if (seconds.value > 0) seconds.value--
  }, 1000)
})
onUnmounted(() => clearInterval(timer))

function send() {
  if (!draft.value.trim()) return
  messages.value.push({ id: 'user-1', name: 'Minh', time: 'now', text: draft.value.trim(), me: true })
  draft.value = ''
}

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 1).join('').toUpperCase()
}
</script>

<template>
  <div v-if="room">
    <!-- Header -->
    <div class="room-top">
      <div>
        <div class="rt-crumb">
          <router-link v-if="subject" :to="{ name: 'subject-hub', params: { id: subject.id } }" class="crumb-link">{{ subject.code }}</router-link>
          <template v-else>{{ subject?.code }}</template> · Group 4
        </div>
        <div class="rt-titlerow">
          <h2 class="rt-title">{{ room.name }}</h2>
          <span class="rec-badge"><span class="rec-dot"></span>{{ t('rooms.recLive') }}</span>
          <span class="rt-students"><i class="bi bi-people"></i>{{ t('rooms.studentsCount', { n: participants.length }) }}</span>
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
        <div class="video-grid">
          <div
            v-for="p in participants"
            :key="p.id"
            class="video-tile"
            :class="{ speaking: p.speaking }"
          >
            <img v-if="p.cameraOn" :src="p.portrait" class="tile-full" :alt="p.name" />
            <img v-else :src="p.portrait" class="tile-avatar" :alt="p.name" />
            <i v-if="p.speaking" class="bi bi-reception-4 tile-signal"></i>
            <span class="tile-name">{{ p.name }}</span>
            <span v-if="p.muted" class="tile-mute"><i class="bi bi-mic-mute-fill"></i></span>
          </div>
        </div>

        <!-- Call controls -->
        <div class="call-controls">
          <button class="cc-btn" title="Mute"><i class="bi bi-mic-fill"></i></button>
          <button class="cc-btn" title="Camera"><i class="bi bi-camera-video-fill"></i></button>
          <button class="cc-btn primary" title="Share screen"><i class="bi bi-display"></i></button>
          <button class="cc-btn" title="Reactions"><i class="bi bi-emoji-smile"></i></button>
          <router-link to="/rooms" class="cc-btn danger" title="Leave"><i class="bi bi-telephone-x-fill"></i></router-link>
        </div>
      </div>

      <!-- Right rail -->
      <div class="room-rail">
        <div class="panel">
          <div class="rail-label"><i class="bi bi-activity"></i>{{ t('rooms.liveActivity') }}</div>
          <div v-for="(a, i) in activity" :key="i" class="activity-line">
            <span class="al-dot" :style="{ background: a.color }"></span>
            <span>{{ a.text }}</span>
            <span class="al-time">{{ a.ago }}</span>
          </div>
        </div>

        <div class="panel">
          <div class="rail-label"><i class="bi bi-folder2-open"></i>{{ t('rooms.sharedResources') }}</div>
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
            <div v-for="(m, i) in messages" :key="i" class="chat-msg" :class="{ me: m.me }">
              <span class="cm-avatar">{{ initials(m.name) }}</span>
              <div class="cm-body">
                <div class="cm-meta">{{ m.name }} · {{ m.time }}</div>
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
