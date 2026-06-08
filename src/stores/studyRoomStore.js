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
    activityFeed: [] // newest first
  }),

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
          }
        }
      })
    },

    /** Broadcast that the current user did something in the room. */
    sendActivity(message) {
      roomChannel?.sendActivity({ message })
    },

    leaveRoom() {
      roomChannel?.leave()
      roomChannel = null
      this.activeRoom = null
      this.onlineUsers = []
      this.activityFeed = []
    }
  }
})
