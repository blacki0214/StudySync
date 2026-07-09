<script setup>
/**
 * StudyRoomView — a Discord-style study room: a channel rail (creatable text +
 * voice channels), the active text channel's live chat, and a member list.
 * Chat + presence + channels are REAL over Supabase Realtime (simulated in demo
 * mode). Voice channels use real peer-to-peer WebRTC audio via useVoiceChat.
 */
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useContentStore } from '../stores/contentStore.js'
import { useStudyRoomStore } from '../stores/studyRoomStore.js'
import { useAuthStore } from '../stores/authStore.js'
import { useDialogStore } from '../stores/dialogStore.js'
import { useVoiceChat } from '../composables/useVoiceChat.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const content = useContentStore()
const rooms = useStudyRoomStore()
const auth = useAuthStore()
const dialog = useDialogStore()
// Destructure so the refs unwrap correctly in the template (they're nested on
// a plain object otherwise, which Vue does not auto-unwrap).
const { muted: voiceMuted, micError: voiceMicError, speakingIds, join: joinVoiceAudio, leave: leaveVoiceAudio, toggleMute: toggleVoiceMute } = useVoiceChat()

const room = computed(() => content.rooms.find((r) => r.id === route.params.id) || content.rooms[0])
const subject = computed(() => content.subjectById(room.value?.subject_id))

const activeText = ref('')
const stageVoice = ref(null) // voice channel whose stage is shown in main, or null (= chat)
const draft = ref('')
const scroller = ref(null)

const isSpeaking = (id) => speakingIds.value.includes(id)
const stageChannelName = computed(() => voiceChannels.value.find((c) => c.id === stageVoice.value)?.name || '')
const stageMembers = computed(() => (stageVoice.value ? rooms.voiceMembers(stageVoice.value) : []))

const meId = computed(() => auth.user?.id || 'anon')
const online = computed(() => rooms.onlineUsers)
const myVoice = computed(() => rooms.myVoice)
const textChannels = computed(() => rooms.textChannels)
const voiceChannels = computed(() => rooms.voiceChannels)
const channelMsgs = computed(() => rooms.channelMessages(activeText.value))
const activeChannelName = computed(() => textChannels.value.find((c) => c.id === activeText.value)?.name || '')
const connectedVoiceName = computed(() => voiceChannels.value.find((c) => c.id === myVoice.value)?.name || '')
const voiceMembers = (id) => rooms.voiceMembers(id)

onMounted(async () => {
  await content.ensureLoaded()
  await rooms.enterRoom(route.params.id)
})
onUnmounted(() => {
  leaveVoiceAudio()
  rooms.leaveRoom()
})

// Keep a valid active text channel selected as channels load/change.
watch(
  () => textChannels.value.map((c) => c.id).join(','),
  () => { if (!textChannels.value.some((c) => c.id === activeText.value)) activeText.value = textChannels.value[0]?.id || '' },
  { immediate: true }
)

// Auto-scroll chat to the newest message.
watch(() => channelMsgs.value.length, async () => {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
})

function send() {
  const text = draft.value.trim()
  if (!text || !activeText.value) return
  rooms.sendChat(text, activeText.value)
  draft.value = ''
}

// Click a voice channel → show its stage in the main area and connect (if not
// already in it). Leaving is only via the red disconnect button.
async function selectVoice(c) {
  stageVoice.value = c.id
  if (myVoice.value === c.id) return
  if (myVoice.value) leaveVoiceAudio()
  rooms.setVoice(c.id)
  await joinVoiceAudio(c.id)
  if (voiceMicError.value) dialog.toast(t('rooms.micDenied'), 'warning')
  rooms.sendActivity(`joined ${c.name} voice`)
}
function selectText(c) {
  activeText.value = c.id
  stageVoice.value = null
}
function disconnectVoice() {
  rooms.setVoice(null)
  leaveVoiceAudio()
  stageVoice.value = null
}

async function addChannel(kind) {
  const name = await dialog.promptText({
    title: kind === 'voice' ? t('rooms.newVoice') : t('rooms.newText'),
    label: t('rooms.channelName'),
    placeholder: kind === 'voice' ? 'Study Hall' : 'general'
  })
  if (!name || !name.trim()) return
  try {
    await rooms.createChannel({ name, kind })
  } catch (e) {
    dialog.toast(e.message || t('rooms.createFailed'), 'error')
  }
}
async function removeChannel(c) {
  if (c.kind === 'text' && textChannels.value.length <= 1) { dialog.toast(t('rooms.needOneText'), 'warning'); return }
  const ok = await dialog.confirm({ message: t('rooms.deleteChannelConfirm', { name: c.name }), danger: true })
  if (!ok) return
  if (myVoice.value === c.id) disconnectVoice()
  await rooms.deleteChannel(c.id)
}

function leaveRoom() {
  leaveVoiceAudio()
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

      <div class="dc-section">
        <span>{{ t('rooms.textChannels') }}</span>
        <button class="dc-add" :title="t('rooms.newText')" @click="addChannel('text')"><i class="bi bi-plus-lg"></i></button>
      </div>
      <div v-for="c in textChannels" :key="c.id" class="dc-ch-wrap">
        <button class="dc-channel" :class="{ active: activeText === c.id && !stageVoice }" @click="selectText(c)">
          <i class="bi bi-hash"></i><span>{{ c.name }}</span>
        </button>
        <button class="dc-del" :title="t('rooms.deleteChannel')" @click.stop="removeChannel(c)"><i class="bi bi-x"></i></button>
      </div>

      <div class="dc-section">
        <span>{{ t('rooms.voiceChannels') }}</span>
        <button class="dc-add" :title="t('rooms.newVoice')" @click="addChannel('voice')"><i class="bi bi-plus-lg"></i></button>
      </div>
      <div v-for="c in voiceChannels" :key="c.id" class="dc-voice-group">
        <div class="dc-ch-wrap">
          <button class="dc-channel" :class="{ active: stageVoice === c.id, connected: myVoice === c.id }" @click="selectVoice(c)">
            <i class="bi bi-volume-up"></i><span>{{ c.name }}</span>
            <span v-if="voiceMembers(c.id).length" class="dc-vcount">{{ voiceMembers(c.id).length }}</span>
          </button>
          <button class="dc-del" :title="t('rooms.deleteChannel')" @click.stop="removeChannel(c)"><i class="bi bi-x"></i></button>
        </div>
        <div v-for="m in voiceMembers(c.id)" :key="m.id" class="dc-voice-member" :class="{ speaking: isSpeaking(m.id) }">
          <span class="dc-mini-av">{{ initials(m.full_name) }}</span>
          <span class="dc-vm-name">{{ m.full_name }}<template v-if="m.id === meId"> ({{ t('rooms.you') }})</template></span>
          <i class="bi dc-vm-mic" :class="m.id === meId && voiceMuted ? 'bi-mic-mute-fill muted' : 'bi-mic-fill'"></i>
        </div>
      </div>

      <!-- Voice-connected bar -->
      <div v-if="myVoice" class="dc-voicebar">
        <div class="dc-vb-info">
          <i class="bi bi-broadcast dc-vb-live"></i>
          <div>
            <div class="dc-vb-status">{{ voiceMicError ? t('rooms.noMic') : t('rooms.voiceConnected') }}</div>
            <div class="dc-vb-name">{{ connectedVoiceName }}</div>
          </div>
        </div>
        <div class="dc-vb-controls">
          <button class="dc-vb-btn" :class="{ off: voiceMuted }" :title="t('rooms.mute')" @click="toggleVoiceMute()"><i class="bi" :class="voiceMuted ? 'bi-mic-mute-fill' : 'bi-mic-fill'"></i></button>
          <button class="dc-vb-btn danger" :title="t('rooms.disconnect')" @click="disconnectVoice"><i class="bi bi-telephone-x-fill"></i></button>
        </div>
      </div>
    </aside>

    <!-- Main: voice stage or the active text channel -->
    <main class="dc-main">
      <header class="dc-main-head">
        <div class="dc-ch-title"><i class="bi" :class="stageVoice ? 'bi-volume-up' : 'bi-hash'"></i>{{ stageVoice ? stageChannelName : activeChannelName }}</div>
        <button class="btn btn-outline-soft btn-sm dc-leave" @click="leaveRoom"><i class="bi bi-box-arrow-right"></i>{{ t('rooms.leave') }}</button>
      </header>

      <!-- Voice stage: avatar tiles with a speaking ring -->
      <div v-if="stageVoice" class="dc-stage">
        <div v-if="!stageMembers.length" class="dc-ch-empty">
          <i class="bi bi-mic"></i>
          <p>{{ t('rooms.voiceEmpty') }}</p>
        </div>
        <div v-else class="dc-stage-grid">
          <div v-for="m in stageMembers" :key="m.id" class="dc-stage-tile" :class="{ speaking: isSpeaking(m.id) }">
            <div class="dc-stage-av">
              <img v-if="m.avatar" :src="m.avatar" :alt="m.full_name" />
              <span v-else>{{ initials(m.full_name) }}</span>
              <span v-if="m.id === meId && voiceMuted" class="dc-stage-mute"><i class="bi bi-mic-mute-fill"></i></span>
            </div>
            <div class="dc-stage-name">{{ m.full_name }}<template v-if="m.id === meId"> ({{ t('rooms.you') }})</template></div>
          </div>
        </div>
      </div>

      <!-- Text channel chat -->
      <template v-else>
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
      </template>
    </main>

    <!-- Members -->
    <aside class="dc-members">
      <div class="dc-section"><span>{{ t('rooms.members', { n: online.length }) }}</span></div>
      <div v-for="m in online" :key="m.id" class="dc-member">
        <span class="dc-mem-av">{{ initials(m.full_name) }}<span class="dc-presence"></span></span>
        <span class="dc-mem-name">{{ m.full_name }}<template v-if="m.id === meId"> ({{ t('rooms.you') }})</template></span>
        <i v-if="m.id === meId ? myVoice : m.voice" class="bi bi-volume-up-fill dc-mem-voice" :title="t('rooms.voiceChannels')"></i>
      </div>
    </aside>
  </div>
</template>
