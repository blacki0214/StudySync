/**
 * studyRoomService.js
 * ----------------------------------------------------------------------------
 * Study rooms + presence + a shared activity feed. Each room is a Supabase
 * Realtime channel using presence (who's in the room) and broadcast (live
 * activity events such as "started a quiz"). Demo mode simulates a small room.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { sampleSubjects } from '../data/sampleSubjects.js'

const demoRooms = [
  {
    id: 'room-1',
    subject_id: 'sub-1',
    name: 'Vue 3 Study Group',
    description: 'Working through the Composition API and Pinia together.',
    active_users: 4,
    created_at: '2026-06-01T09:00:00Z'
  },
  {
    id: 'room-2',
    subject_id: 'sub-2',
    name: 'Data Structures Crunch',
    description: 'Hash tables, trees and Big-O practice before the exam.',
    active_users: 2,
    created_at: '2026-06-03T09:00:00Z'
  },
  {
    id: 'room-3',
    subject_id: 'sub-3',
    name: 'OOP Revision Room',
    description: 'Encapsulation, inheritance and polymorphism walkthroughs.',
    active_users: 3,
    created_at: '2026-06-05T09:00:00Z'
  }
]

export const studyRoomService = {
  /** List available study rooms (joined with their subject name). */
  async listRooms() {
    if (!isSupabaseConfigured) {
      return demoRooms.map((r) => ({
        ...r,
        subject: sampleSubjects.find((s) => s.id === r.subject_id) || null
      }))
    }
    const { data, error } = await supabase
      .from('study_rooms')
      .select('*, subject:subjects(*)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  /** Fetch one room. */
  async getRoom(id) {
    if (!isSupabaseConfigured) {
      const room = demoRooms.find((r) => r.id === id)
      return room
        ? { ...room, subject: sampleSubjects.find((s) => s.id === room.subject_id) }
        : null
    }
    const { data, error } = await supabase
      .from('study_rooms')
      .select('*, subject:subjects(*)')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  },

  /**
   * Join a room's realtime channel.
   * @returns {{ sendActivity:Function, leave:Function }}
   */
  joinRoom({ roomId, user, handlers }) {
    if (!isSupabaseConfigured) {
      return createDemoRoomChannel({ user, handlers })
    }

    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: user.id } }
    })

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const users = Object.values(state).map((entries) => entries[0])
      handlers.onPresenceChange?.(users)
    })

    channel.on('broadcast', { event: 'activity' }, ({ payload }) => {
      handlers.onActivity?.(payload)
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          id: user.id,
          full_name: user.full_name,
          online_at: new Date().toISOString()
        })
      }
    })

    return {
      sendActivity(activity) {
        channel.send({
          type: 'broadcast',
          event: 'activity',
          payload: {
            userId: user.id,
            fullName: user.full_name,
            ...activity,
            at: new Date().toISOString()
          }
        })
      },
      leave() {
        supabase.removeChannel(channel)
      }
    }
  }
}

/** Simulated room channel for demo mode. */
function createDemoRoomChannel({ user, handlers }) {
  const peers = [
    { id: user.id, full_name: user.full_name },
    { id: 'user-2', full_name: 'Linh Nguyen' },
    { id: 'user-3', full_name: 'Minh Tran' }
  ]

  const presenceTimer = setTimeout(() => handlers.onPresenceChange?.(peers), 500)

  const messages = [
    'joined the room',
    'added a new note',
    'started a quiz',
    'reviewed 12 flashcards'
  ]
  let i = 0
  const activityTimer = setInterval(() => {
    const peer = peers[1 + (i % 2)]
    handlers.onActivity?.({
      userId: peer.id,
      fullName: peer.full_name,
      message: messages[i % messages.length],
      at: new Date().toISOString()
    })
    i++
  }, 5000)

  return {
    sendActivity() {
      /* no-op in demo mode */
    },
    leave() {
      clearTimeout(presenceTimer)
      clearInterval(activityTimer)
    }
  }
}
