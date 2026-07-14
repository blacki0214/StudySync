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

// Default channel set seeded into every new/empty room.
const DEFAULT_CHANNELS = [
  { name: 'general', kind: 'text' },
  { name: 'questions', kind: 'text' },
  { name: 'resources', kind: 'text' },
  { name: 'off-topic', kind: 'text' },
  { name: 'Study Hall', kind: 'voice' },
  { name: 'Focus Room', kind: 'voice' }
]

const K_CHANNELS = 'studysync_demo_room_channels'
const readChannels = () => { try { return JSON.parse(localStorage.getItem(K_CHANNELS) || '[]') } catch { return [] } }
const writeChannels = (v) => { try { localStorage.setItem(K_CHANNELS, JSON.stringify(v)) } catch { /* ignore */ } }

// Demo-mode room memberships (invites) — [{ room_id, user_id }].
const K_MEMBERS = 'studysync_demo_room_members'
const readMembers = () => { try { return JSON.parse(localStorage.getItem(K_MEMBERS) || '[]') } catch { return [] } }
const writeMembers = (v) => { try { localStorage.setItem(K_MEMBERS, JSON.stringify(v)) } catch { /* ignore */ } }

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
  /**
   * List the rooms a user can see: the ones they OWN plus the ones they've
   * JOINED via an invite link (room_members). The tables are public-read at the
   * RLS level, so without this scoping a new account would list every room.
   */
  async listRoomsForUser(userId) {
    if (!isSupabaseConfigured) {
      return demoRooms.map((r) => ({
        ...r,
        subject: sampleSubjects.find((s) => s.id === r.subject_id) || null
      }))
    }
    if (!userId) return []

    // Room ids this user joined via invite.
    const { data: mem } = await supabase
      .from('room_members').select('room_id').eq('user_id', userId)
    const joinedIds = (mem || []).map((m) => m.room_id)

    let query = supabase
      .from('study_rooms')
      .select('*, subject:subjects(*)')
      .order('created_at', { ascending: false })
    query = joinedIds.length
      ? query.or(`owner_id.eq.${userId},id.in.(${joinedIds.join(',')})`)
      : query.eq('owner_id', userId)

    const { data, error } = await query
    if (error) throw error
    return data
  },

  /**
   * Join a room as a member (the invite mechanism). Idempotent — re-joining is a
   * no-op. After this the room appears in the user's own room list.
   */
  async joinRoomAsMember({ roomId, userId }) {
    if (!roomId || !userId) return
    if (!isSupabaseConfigured) {
      const all = readMembers()
      if (!all.some((m) => m.room_id === roomId && m.user_id === userId)) {
        writeMembers([...all, { room_id: roomId, user_id: userId }])
      }
      return
    }
    const { error } = await supabase
      .from('room_members')
      .upsert({ room_id: roomId, user_id: userId }, { onConflict: 'room_id,user_id', ignoreDuplicates: true })
    if (error) throw error
  },

  /**
   * Create a study room. Returns it in the shape contentStore.rooms expects
   * ({ id, subject_id, code, name, description, live, active_users }).
   */
  async createRoom({ name, description = '', subjectId = null, ownerId = null }) {
    const cleanName = String(name || '').trim() || 'Study Room'
    if (!isSupabaseConfigured) {
      const subject = sampleSubjects.find((s) => s.id === subjectId) || null
      return {
        id: localId('room'),
        owner_id: ownerId,
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
      .insert({ subject_id: subjectId, owner_id: ownerId, name: cleanName, description: String(description || '').trim(), live: true, active_users: 1 })
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
      .maybeSingle() // null (not an error) when the id doesn't exist — e.g. a bad invite link
    if (error) throw error
    return data
  },

  /** List a room's channels (seeding the default set if it has none). */
  async listChannels(roomId) {
    if (!isSupabaseConfigured) {
      let all = readChannels().filter((c) => c.room_id === roomId)
      if (!all.length) {
        all = DEFAULT_CHANNELS.map((c, i) => ({ id: localId('ch'), room_id: roomId, name: c.name, kind: c.kind, position: i, created_at: new Date().toISOString() }))
        writeChannels([...readChannels(), ...all])
      }
      return all.sort((a, b) => a.position - b.position)
    }
    const { data, error } = await supabase
      .from('room_channels').select('*').eq('room_id', roomId).order('position')
    if (error) throw error
    if (data && data.length) return data
    // Empty room → seed the defaults once.
    const rows = DEFAULT_CHANNELS.map((c, i) => ({ room_id: roomId, name: c.name, kind: c.kind, position: i }))
    const { data: seeded, error: seedErr } = await supabase.from('room_channels').insert(rows).select().order('position')
    if (seedErr) throw seedErr
    return seeded || []
  },

  /** Create a channel in a room. */
  async createChannel({ roomId, name, kind = 'text', position = 99 }) {
    const clean = String(name || '').trim().replace(/^#/, '').slice(0, 40) || 'channel'
    if (!isSupabaseConfigured) {
      const row = { id: localId('ch'), room_id: roomId, name: clean, kind, position, created_at: new Date().toISOString() }
      writeChannels([...readChannels(), row])
      return row
    }
    const { data, error } = await supabase
      .from('room_channels').insert({ room_id: roomId, name: clean, kind, position }).select().single()
    if (error) throw error
    return data
  },

  /** Delete a channel. */
  async deleteChannel(id) {
    if (!isSupabaseConfigured) {
      writeChannels(readChannels().filter((c) => c.id !== id))
      return
    }
    const { error } = await supabase.from('room_channels').delete().eq('id', id)
    if (error) throw error
  },

  /** Subscribe to a room's channel-list changes. Returns an unsubscribe fn. */
  subscribeChannels(roomId, onChange) {
    if (!isSupabaseConfigured) return () => {}
    const ch = supabase
      .channel(`room_channels:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_channels', filter: `room_id=eq.${roomId}` }, () => onChange())
      .subscribe()
    return () => supabase.removeChannel(ch)
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

    // Which voice channel the local user is currently in (null = none). Tracked
    // in presence so everyone sees who's in each voice channel (Discord-style).
    let currentVoice = null

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

    // WebRTC signaling relay (offer/answer/ice) for real voice chat.
    channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
      handlers.onSignal?.(payload)
    })

    const track = () =>
      channel.track({
        id: user.id,
        full_name: user.full_name,
        avatar: user.avatar_url || user.avatar || null,
        online_at: new Date().toISOString(),
        voice: currentVoice
      })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await track()
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
      sendChat(text, channelId = 'general') {
        channel.send({
          type: 'broadcast',
          event: 'chat',
          payload: {
            userId: user.id,
            fullName: user.full_name,
            channel: channelId,
            text,
            at: new Date().toISOString()
          }
        })
      },
      /** Join/leave a voice channel (updates presence for everyone). */
      setVoice(voiceId) {
        currentVoice = voiceId
        track()
      },
      /** Relay a WebRTC signaling message to a specific peer. */
      sendSignal(payload) {
        channel.send({ type: 'broadcast', event: 'signal', payload })
      },
      leave() {
        supabase.removeChannel(channel)
      }
    }
  }
}

/** Simulated room channel for demo mode. */
function createDemoRoomChannel({ user, handlers }) {
  // Two peers already hanging out — one in the Study Hall voice channel.
  const peers = [
    { id: user.id, full_name: user.full_name, voice: null },
    { id: 'user-2', full_name: 'Linh Nguyen', voice: 'voice-study' },
    { id: 'user-3', full_name: 'Minh Tran', voice: null }
  ]
  const me = peers[0]
  const emitPresence = () => handlers.onPresenceChange?.(peers.map((p) => ({ ...p })))

  const presenceTimer = setTimeout(emitPresence, 400)

  // Seed a little chat history across a couple of channels.
  const chatTimer = setTimeout(() => {
    handlers.onChat?.({ userId: 'user-2', fullName: 'Linh Nguyen', channel: 'general', text: 'Hey! Ready to review chapter 4?', at: new Date().toISOString() })
    handlers.onChat?.({ userId: 'user-3', fullName: 'Minh Tran', channel: 'general', text: 'Yep, sharing my notes now 📒', at: new Date().toISOString() })
    handlers.onChat?.({ userId: 'user-2', fullName: 'Linh Nguyen', channel: 'questions', text: 'Can someone explain question 3?', at: new Date().toISOString() })
  }, 700)

  const messages = ['added a new note', 'started a quiz', 'reviewed 12 flashcards', 'shared a document']
  let i = 0
  const activityTimer = setInterval(() => {
    const peer = peers[1 + (i % 2)]
    handlers.onActivity?.({ userId: peer.id, fullName: peer.full_name, message: messages[i % messages.length], at: new Date().toISOString() })
    i++
  }, 5000)

  return {
    sendActivity(activity) {
      handlers.onActivity?.({ userId: user.id, fullName: user.full_name, ...activity, at: new Date().toISOString() })
    },
    sendChat(text, channelId = 'general') {
      handlers.onChat?.({ userId: user.id, fullName: user.full_name, channel: channelId, text, at: new Date().toISOString() })
    },
    setVoice(voiceId) {
      me.voice = voiceId
      emitPresence()
    },
    sendSignal() {
      /* no-op in demo mode — no remote peers to signal */
    },
    leave() {
      clearTimeout(presenceTimer)
      clearTimeout(chatTimer)
      clearInterval(activityTimer)
    }
  }
}
