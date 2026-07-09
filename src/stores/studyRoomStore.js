/**
 * studyRoomStore.js
 * ----------------------------------------------------------------------------
 * Study room list + live presence and activity feed for the active room.
 */

import { defineStore } from 'pinia'
import { studyRoomService } from '../services/studyRoomService.js'
import { useAuthStore } from './authStore.js'

let roomChannel = null
let chUnsub = null
// WebRTC signaling listeners (the voice composable registers here). Kept in
// module scope because they hold non-serialisable closures.
const signalListeners = new Set()

export const useStudyRoomStore = defineStore('studyRooms', {
  state: () => ({
    rooms: [],
    loading: false,
    activeRoom: null,
    onlineUsers: [],
    activityFeed: [], // newest first
    messages: [], // group chat, oldest first (each has a `channel`)
    myVoice: null, // voice channel id the current user has joined, or null
    channels: [] // this room's text/voice channels
  }),

  getters: {
    /** Messages in one text channel, oldest first. */
    channelMessages: (state) => (channelId) =>
      state.messages.filter((m) => (m.channel || 'general') === channelId),
    /**
     * Online users currently in a given voice channel. Remote members come from
     * presence; the LOCAL user is included from `myVoice` (the source of truth
     * for us) so our own tile appears instantly without waiting on a presence
     * round-trip.
     */
    voiceMembers: (state) => (voiceId) => {
      const auth = useAuthStore()
      const meId = auth.user?.id || 'anon'
      const others = state.onlineUsers.filter((u) => u.voice === voiceId && u.id !== meId)
      if (state.myVoice === voiceId) {
        const meEntry = state.onlineUsers.find((u) => u.id === meId) || {}
        return [
          { id: meId, full_name: auth.user?.full_name || 'You', avatar: auth.user?.avatar_url || null, ...meEntry, voice: voiceId },
          ...others
        ]
      }
      return others
    },
    textChannels: (state) => state.channels.filter((c) => c.kind === 'text'),
    voiceChannels: (state) => state.channels.filter((c) => c.kind === 'voice')
  },

  actions: {
    async fetchRooms() {
      this.loading = true
      try {
        this.rooms = await studyRoomService.listRooms()
      } finally {
        this.loading = false
      }
    },

    /** Enter a room and start receiving presence + activity in real time. */
    async enterRoom(id) {
      const auth = useAuthStore()
      this.leaveRoom()

      this.activeRoom = await studyRoomService.getRoom(id)
      this.activityFeed = []
      this.messages = []
      this.myVoice = null

      // Load this room's channels and keep them in sync across users.
      await this.loadChannels(id)
      chUnsub?.()
      chUnsub = studyRoomService.subscribeChannels(id, () => this.loadChannels(id))

      roomChannel = studyRoomService.joinRoom({
        roomId: id,
        user: auth.user || { id: 'anon', full_name: 'Anonymous' },
        handlers: {
          onPresenceChange: (users) => {
            this.onlineUsers = users
          },
          onActivity: (activity) => {
            // Prepend, cap the feed at 30 entries.
            this.activityFeed = [activity, ...this.activityFeed].slice(0, 30)
          },
          onChat: (message) => {
            // Append, cap the log at 100 messages.
            this.messages = [...this.messages, message].slice(-100)
          },
          onSignal: (payload) => {
            signalListeners.forEach((cb) => cb(payload))
          }
        }
      })
    },

    async loadChannels(roomId) {
      try {
        this.channels = await studyRoomService.listChannels(roomId)
      } catch (e) {
        console.warn('[rooms] channels load failed:', e.message)
      }
    },

    async createChannel({ name, kind = 'text' }) {
      const row = await studyRoomService.createChannel({
        roomId: this.activeRoom?.id,
        name,
        kind,
        position: this.channels.length
      })
      // Optimistic add (the realtime subscription reconciles in live mode).
      if (!this.channels.some((c) => c.id === row.id)) this.channels.push(row)
      return row
    },

    async deleteChannel(id) {
      this.channels = this.channels.filter((c) => c.id !== id)
      try {
        await studyRoomService.deleteChannel(id)
      } catch (e) {
        console.warn('[rooms] channel delete failed:', e.message)
      }
    },

    /** Register a WebRTC signal handler. Returns an unregister fn. */
    onSignal(cb) {
      signalListeners.add(cb)
      return () => signalListeners.delete(cb)
    },
    /** Relay a WebRTC signal to a peer. */
    sendSignal(payload) {
      roomChannel?.sendSignal?.(payload)
    },

    /** Broadcast that the current user did something in the room. */
    sendActivity(message) {
      roomChannel?.sendActivity({ message })
    },

    /** Send a message to a specific text channel. */
    sendChat(text, channelId = 'general') {
      const clean = String(text || '').trim()
      if (clean) roomChannel?.sendChat(clean, channelId)
    },

    /** Join a voice channel (or leave, with null). Broadcasts via presence. */
    setVoice(voiceId) {
      this.myVoice = voiceId
      roomChannel?.setVoice(voiceId)
    },

    leaveRoom() {
      roomChannel?.leave()
      roomChannel = null
      chUnsub?.()
      chUnsub = null
      this.activeRoom = null
      this.onlineUsers = []
      this.activityFeed = []
      this.messages = []
      this.myVoice = null
      this.channels = []
    }
  }
})
