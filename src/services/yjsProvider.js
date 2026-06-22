/**
 * yjsProvider.js
 * ----------------------------------------------------------------------------
 * A minimal Yjs provider that syncs a Y.Doc over a Supabase Realtime channel —
 * our self-hosted alternative to y-websocket. It carries:
 *   • document updates  — small binary CRDT deltas (base64) → conflict-free merge
 *   • awareness         — cursors / selections / who's online (live presence)
 *   • a join handshake  — late joiners request state and peers reply with a diff
 *
 * Because Yjs is a CRDT, concurrent edits merge automatically with no central
 * transform server and no version-conflict logic. Payloads are tiny (only the
 * change), which is what makes it feel instant like Google Docs / Notion.
 */

import * as Y from 'yjs'
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import { supabase } from './supabaseClient.js'

// ---- base64 <-> Uint8Array (Supabase broadcast carries JSON strings) -------
function u8ToBase64(u8) {
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < u8.length; i += chunk) s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk))
  return btoa(s)
}
function base64ToU8(b64) {
  const s = atob(b64)
  const u8 = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i)
  return u8
}

const CURSOR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#d946ef', '#3b82f6', '#ef4444', '#14b8a6']
function colorFor(id) {
  let h = 0
  for (let i = 0; i < (id || '').length; i++) h = (h << 5) - h + id.charCodeAt(i)
  return CURSOR_COLORS[Math.abs(h) % CURSOR_COLORS.length]
}

export class SupabaseYjsProvider {
  /**
   * @param {string} noteId
   * @param {Y.Doc} doc
   * @param {{ user: { id: string, full_name: string } }} opts
   */
  constructor(noteId, doc, { user }) {
    this.doc = doc
    this.awareness = new Awareness(doc)
    this.awareness.setLocalStateField('user', {
      name: user?.full_name || 'Guest',
      color: colorFor(user?.id || 'guest')
    })

    this.channel = supabase.channel(`yjs:${noteId}`, { config: { broadcast: { self: false } } })

    // Remote document updates → merge into our doc (origin=this prevents echo).
    this.channel.on('broadcast', { event: 'doc' }, ({ payload }) => {
      Y.applyUpdate(this.doc, base64ToU8(payload.u), this)
    })
    // Remote awareness (cursors / presence).
    this.channel.on('broadcast', { event: 'awareness' }, ({ payload }) => {
      applyAwarenessUpdate(this.awareness, base64ToU8(payload.u), this)
    })
    // A peer just joined and asked for state → reply with a diff + our awareness.
    this.channel.on('broadcast', { event: 'sync' }, ({ payload }) => {
      const diff = Y.encodeStateAsUpdate(this.doc, base64ToU8(payload.sv))
      this._send('doc', { u: u8ToBase64(diff) })
      this._broadcastAwareness([this.doc.clientID])
    })

    // Local doc changes → broadcast just the delta.
    this._onDocUpdate = (update, origin) => {
      if (origin === this) return
      this._send('doc', { u: u8ToBase64(update) })
    }
    this.doc.on('update', this._onDocUpdate)

    // Local awareness changes → broadcast.
    this._onAwareness = ({ added, updated, removed }) => {
      this._broadcastAwareness(added.concat(updated, removed))
    }
    this.awareness.on('update', this._onAwareness)

    this.synced = false
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Ask peers for everything we don't have yet.
        this._send('sync', { sv: u8ToBase64(Y.encodeStateVector(this.doc)) })
        this._broadcastAwareness([this.doc.clientID])
        this.synced = true
      }
    })
  }

  _send(event, payload) {
    this.channel.send({ type: 'broadcast', event, payload })
  }
  _broadcastAwareness(clients) {
    this._send('awareness', { u: u8ToBase64(encodeAwarenessUpdate(this.awareness, clients)) })
  }

  destroy() {
    try {
      this.doc.off('update', this._onDocUpdate)
      this.awareness.off('update', this._onAwareness)
      removeAwarenessStates(this.awareness, [this.doc.clientID], 'disconnect')
    } catch { /* ignore */ }
    supabase.removeChannel(this.channel)
  }
}

export { u8ToBase64, base64ToU8 }
