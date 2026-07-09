/**
 * studyRoomStore.js
 * ----------------------------------------------------------------------------
 * Study room list + live presence and activity feed for the active room.
 */

import { defineStore } from 'pinia'
import { studyRoomService } from '../services/studyRoomService.js'
import { useAuthStore } from './authStore.js'

let roomChannel = null

export const useStudyRoomStore = defineStore('studyRooms', {
  state: () => ({
    rooms: [],
    loading: false,
    activeRoom: null,
    onlineUsers: [],
    activityFeed: [], // newest first
    messages: [], // group chat, oldest first (each has a `channel`)
    myVoice: null // voice channel id the current user has joined, or null
  }),

  getters: {
    /** Messages in one text channel, oldest first. */
    channelMessages: (state) => (channelId) =>
      state.messages.filter((m) => (m.channel || 'general') === channelId),
    /** Online users currently in a given voice channel. */
    voiceMembers: (state) => (voiceId) =>
      state.onlineUsers.filter((u) => u.voice === voiceId)
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
          }
        }
      })
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
      this.activeRoom = null
      this.onlineUsers = []
      this.activityFeed = []
      this.messages = []
      this.myVoice = null
    }
  }
})
