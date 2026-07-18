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

// Prefer the room we actually entered (fetched by id, unscoped) so an
// invite-opened room the user doesn't own still resolves; fall back to the list.
const room = computed(() => rooms.activeRoom || content.rooms.find((r) => r.id === route.params.id))
const subject = computed(() => content.subjectById(room.value?.subject_id))

// --- Invite (share link) ---
const showInvite = ref(false)
const inviteLink = computed(() => `${window.location.origin}/rooms/${room.value?.id || route.params.id}`)
async function copyInvite() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    dialog.toast(t('rooms.inviteCopied'), 'success')
  } catch {
    dialog.toast(t('rooms.inviteCopyFailed'), 'error')
  }
}

const activeText = ref('')
const stageVoice = ref(null) // voice channel whose stage is shown in main, or null (= chat)
const draft = ref('')
const scroller = ref(null)
// Mobile: which side panel is open as a slide-in drawer ('channels' | 'members'
// | null). On desktop the rail + member list are always-visible columns.
const mobilePanel = ref(null)

const isSpeaking = (id) => speakingIds.value.includes(id)
const stageChannelName = computed(() => voiceChannels.value.find((c) => c.id === stageVoice.value)?.name || '')
const stageMembers = computed(() => (stageVoice.value ? rooms.voiceMembers(stageVoice.value) : []))

// Distinguish "still entering" from "room genuinely not found" so a bad invite
// link shows a message instead of hanging on a blank screen.
const entering = ref(true)
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
  const alreadyListed = content.rooms.some((r) => r.id === route.params.id)
  try {
    await rooms.enterRoom(route.params.id) // records membership for non-owners
  } finally {
    entering.value = false
  }
  // Surface a newly-joined room in the user's list immediately + confirm the join.
  if (rooms.activeRoom && !alreadyListed) {
    content.rooms.unshift(rooms.activeRoom)
    if (rooms.activeRoom.owner_id && rooms.activeRoom.owner_id !== auth.user?.id) {
      dialog.toast(t('rooms.joinedViaInvite', { name: rooms.activeRoom.name }), 'success')
    }
  }
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
  mobilePanel.value = null // close the mobile channel drawer on pick
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
  mobilePanel.value = null // close the mobile channel drawer on pick
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
    <!-- Channel rail (a slide-in drawer on mobile) -->
    <aside class="dc-rail" :class="{ 'dc-open': mobilePanel === 'channels' }">
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
        <!-- Mobile-only: open the channel rail drawer. -->
        <button class="dc-m-btn" :aria-label="t('rooms.channels')" @click="mobilePanel = 'channels'"><i class="bi bi-list"></i></button>
        <div class="dc-ch-title"><i class="bi" :class="stageVoice ? 'bi-volume-up' : 'bi-hash'"></i>{{ stageVoice ? stageChannelName : activeChannelName }}</div>
        <div class="dc-head-actions">
          <button class="btn btn-brand btn-sm" @click="showInvite = true"><i class="bi bi-person-plus"></i>{{ t('rooms.invite') }}</button>
          <button class="btn btn-outline-soft btn-sm dc-leave" @click="leaveRoom"><i class="bi bi-box-arrow-right"></i>{{ t('rooms.leave') }}</button>
          <!-- Mobile-only: open the member-list drawer. -->
          <button class="dc-m-btn" :aria-label="t('rooms.members', { n: online.length })" @click="mobilePanel = 'members'"><i class="bi bi-people"></i></button>
        </div>
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

    <!-- Members (a slide-in drawer on mobile) -->
    <aside class="dc-members" :class="{ 'dc-open': mobilePanel === 'members' }">
      <div class="dc-section"><span>{{ t('rooms.members', { n: online.length }) }}</span></div>
      <div v-for="m in online" :key="m.id" class="dc-member">
        <span class="dc-mem-av">{{ initials(m.full_name) }}<span class="dc-presence"></span></span>
        <span class="dc-mem-name">{{ m.full_name }}<template v-if="m.id === meId"> ({{ t('rooms.you') }})</template></span>
        <i v-if="m.id === meId ? myVoice : m.voice" class="bi bi-volume-up-fill dc-mem-voice" :title="t('rooms.voiceChannels')"></i>
      </div>
    </aside>

    <!-- Mobile drawer scrim (behind the open rail / member list). -->
    <div v-if="mobilePanel" class="dc-scrim" @click="mobilePanel = null"></div>

    <!-- Invite modal: share this link so others can join the room -->
    <div v-if="showInvite" class="room-modal-backdrop" @click.self="showInvite = false">
      <div class="room-modal" role="dialog" aria-modal="true">
        <div class="rm-head">
          <h3>{{ t('rooms.inviteTitle') }}</h3>
          <button class="btn-icon-sq" :aria-label="t('common.cancel')" @click="showInvite = false"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="rm-body">
          <p class="rm-invite-desc">{{ t('rooms.inviteDesc') }}</p>
          <div class="rm-invite-row">
            <input class="rm-input" :value="inviteLink" readonly @focus="$event.target.select()" />
            <button class="btn btn-brand" @click="copyInvite"><i class="bi bi-clipboard"></i>{{ t('rooms.inviteCopy') }}</button>
          </div>
        </div>
        <div class="rm-foot">
          <button class="btn btn-outline-soft" @click="showInvite = false">{{ t('common.close') }}</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Invalid / expired invite link, or a room that no longer exists -->
  <div v-else-if="!entering" class="empty-state">
    <i class="bi bi-door-closed empty-icon"></i>
    <p>{{ t('rooms.notFound') }}</p>
    <router-link to="/rooms" class="btn btn-brand">{{ t('rooms.title') }}</router-link>
  </div>
</template>
