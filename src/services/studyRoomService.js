/**
 * studyRoomService.js
 * ----------------------------------------------------------------------------
 * Study rooms + presence + a shared activity feed. Each room is a Supabase
 * Realtime channel using presence (who's in the room) and broadcast (live
 * activity events such as "started a quiz"). Demo mode simulates a small room.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { sampleSubjects } from '../data/sampleSubjects.js'

function localId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

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

  /**
   * Create a study room. Returns it in the shape contentStore.rooms expects
   * ({ id, subject_id, code, name, description, live, active_users }).
   */
  async createRoom({ name, description = '', subjectId = null }) {
    const cleanName = String(name || '').trim() || 'Study Room'
    if (!isSupabaseConfigured) {
      const subject = sampleSubjects.find((s) => s.id === subjectId) || null
      return {
        id: localId('room'),
        subject_id: subjectId,
        code: subject?.code || 'General',
        name: cleanName,
        description: String(description || '').trim(),
        live: true,
        active_users: 1,
        created_at: new Date().toISOString()
      }
    }
    const { data, error } = await supabase
      .from('study_rooms')
      .insert({ subject_id: subjectId, name: cleanName, description: String(description || '').trim(), live: true, active_users: 1 })
      .select()
      .single()
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

    // `broadcast.self: true` echoes our own chat/activity back to us, so the
    // sender sees their message via the same handler as everyone else — no
    // separate optimistic path needed.
    const channel = supabase.channel(`room:${roomId}`, {
      config: { presence: { key: user.id }, broadcast: { self: true } }
    })

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const users = Object.values(state).map((entries) => entries[0])
      handlers.onPresenceChange?.(users)
    })

    channel.on('broadcast', { event: 'activity' }, ({ payload }) => {
      handlers.onActivity?.(payload)
    })

    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      handlers.onChat?.(payload)
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          id: user.id,
          full_name: user.full_name,
          online_at: new Date().toISOString()
        })
        // Announce arrival so others see a live activity line.
        handlers.onActivity && channel.send({
          type: 'broadcast',
          event: 'activity',
          payload: { userId: user.id, fullName: user.full_name, message: 'joined the room', at: new Date().toISOString() }
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
      sendChat(text) {
        channel.send({
          type: 'broadcast',
          event: 'chat',
          payload: {
            userId: user.id,
            fullName: user.full_name,
            text,
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

  // Seed a little chat history so the panel isn't empty on entry.
  const chatTimer = setTimeout(() => {
    handlers.onChat?.({ userId: 'user-2', fullName: 'Linh Nguyen', text: 'Hey! Ready to review chapter 4?', at: new Date().toISOString() })
    handlers.onChat?.({ userId: 'user-3', fullName: 'Minh Tran', text: 'Yep, sharing my notes now 📒', at: new Date().toISOString() })
  }, 800)

  const messages = [
    'added a new note',
    'started a quiz',
    'reviewed 12 flashcards',
    'shared a document'
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
    sendActivity(activity) {
      // Echo the local user's own activity so they see their action land.
      handlers.onActivity?.({ userId: user.id, fullName: user.full_name, ...activity, at: new Date().toISOString() })
    },
    sendChat(text) {
      // Echo locally (demo has no server to bounce it back).
      handlers.onChat?.({ userId: user.id, fullName: user.full_name, text, at: new Date().toISOString() })
    },
    leave() {
      clearTimeout(presenceTimer)
      clearTimeout(chatTimer)
      clearInterval(activityTimer)
    }
  }
}
