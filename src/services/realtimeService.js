/**
 * realtimeService.js
 * ----------------------------------------------------------------------------
 * The realtime collaboration layer. This goes well beyond "subscribe to DB
 * changes": for each note we open a Supabase Realtime CHANNEL that carries
 * THREE distinct realtime mechanisms working together:
 *
 *   1. postgres_changes  — server-authoritative updates when a row is written.
 *   2. presence          — who is currently in the note (online users list).
 *   3. broadcast         — low-latency, peer-to-peer "I am typing" / live cursor
 *                          signals that never touch the database.
 *
 * The store layer combines these with debounced saving, optimistic UI and the
 * version-conflict check in noteService to deliver true collaborative editing.
 *
 * In DEMO MODE we simulate a second collaborator and presence so the feature is
 * still demonstrable offline.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'

/**
 * Join the realtime channel for a note.
 *
 * @param {object} params
 * @param {string} params.noteId
 * @param {object} params.user        current user { id, full_name }
 * @param {object} params.handlers
 * @param {(payload:object)=>void} params.handlers.onRemoteUpdate  DB row changed
 * @param {(users:object[])=>void} params.handlers.onPresenceChange online users
 * @param {(payload:object)=>void} params.handlers.onTyping        someone typing
 * @returns {{ broadcastTyping:Function, leave:Function }}
 */
export function joinNoteChannel({ noteId, user, handlers }) {
  if (!isSupabaseConfigured) {
    return createDemoChannel({ user, handlers })
  }

  const channel = supabase.channel(`note:${noteId}`, {
    config: { presence: { key: user.id } }
  })

  // 1. Database changes for THIS note row.
  channel.on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'notes', filter: `id=eq.${noteId}` },
    (payload) => handlers.onRemoteUpdate?.(payload.new)
  )

  // 2. Presence — recompute the online user list whenever it syncs.
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    // presenceState() => { key: [ {meta...} ] }; flatten to a user array.
    const users = Object.values(state).map((entries) => entries[0])
    handlers.onPresenceChange?.(users)
  })

  // 3. Broadcast typing indicators (does NOT hit the database).
  channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
    handlers.onTyping?.(payload)
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
    /** Tell other peers this user is typing (throttled by the caller). */
    broadcastTyping(isTyping) {
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, fullName: user.full_name, isTyping }
      })
    },
    /** Leave the channel and stop tracking presence. */
    leave() {
      supabase.removeChannel(channel)
    }
  }
}

/**
 * Demo-mode channel: fabricates a second collaborator and emits a presence
 * update + an occasional typing ping so the UI behaves realistically offline.
 */
function createDemoChannel({ user, handlers }) {
  const fakePeer = {
    id: 'user-2',
    full_name: 'Linh Nguyen',
    online_at: new Date().toISOString()
  }

  // Emit presence shortly after join: the current user + one simulated peer.
  const presenceTimer = setTimeout(() => {
    handlers.onPresenceChange?.([
      { id: user.id, full_name: user.full_name, online_at: new Date().toISOString() },
      fakePeer
    ])
  }, 600)

  // Periodically toggle the peer's typing indicator.
  let typing = false
  const typingTimer = setInterval(() => {
    typing = !typing
    handlers.onTyping?.({ userId: fakePeer.id, fullName: fakePeer.full_name, isTyping: typing })
  }, 4000)

  return {
    broadcastTyping() {
      /* no-op in demo mode */
    },
    leave() {
      clearTimeout(presenceTimer)
      clearInterval(typingTimer)
    }
  }
}
