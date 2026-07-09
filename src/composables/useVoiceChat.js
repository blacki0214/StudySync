/**
 * useVoiceChat — real peer-to-peer voice for study-room voice channels.
 * ----------------------------------------------------------------------------
 * WebRTC mesh: each participant in the same voice channel opens an
 * RTCPeerConnection to every other participant. Signaling (offer/answer/ICE) is
 * relayed over the room's existing Supabase Realtime channel via
 * studyRoomStore.sendSignal / onSignal. Who is in which voice channel comes
 * from presence (rooms.voiceMembers), which this composable watches to open/
 * close connections automatically.
 *
 * Deterministic initiator (smaller userId offers) avoids offer glare. Works
 * only in live mode (demo has no signaling transport / no real peers), but the
 * mic still opens so the mute button behaves.
 */

import { ref, watch } from 'vue'
import { useStudyRoomStore } from '../stores/studyRoomStore.js'
import { useAuthStore } from '../stores/authStore.js'

const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

export function useVoiceChat() {
  const rooms = useStudyRoomStore()
  const auth = useAuthStore()

  const connected = ref(false) // in a voice channel
  const muted = ref(false)
  const micError = ref(false) // getUserMedia was denied/unavailable
  const peerCount = ref(0)
  const speakingIds = ref([]) // ids currently talking (for the speaking ring)

  let localStream = null
  const peers = new Map() // peerId -> { pc, audioEl }
  let removeSignal = null
  let stopWatch = null

  // --- Speaking detection (Web Audio) ---
  let audioCtx = null
  const analysers = new Map() // id -> { analyser, data, lastAbove }
  let rafId = null

  const myId = () => auth.user?.id || 'anon'

  function ensureCtx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      audioCtx = new AC()
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
    return audioCtx
  }
  function addAnalyser(id, stream) {
    const ctx = ensureCtx()
    if (!ctx) return
    try {
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      src.connect(analyser)
      analysers.set(id, { analyser, data: new Uint8Array(analyser.frequencyBinCount), lastAbove: 0 })
      if (!rafId) rafId = requestAnimationFrame(levelLoop)
    } catch { /* ignore */ }
  }
  function removeAnalyser(id) { analysers.delete(id) }
  function levelLoop() {
    const now = performance.now()
    const speaking = []
    for (const [id, a] of analysers) {
      a.analyser.getByteTimeDomainData(a.data)
      let sum = 0
      for (let i = 0; i < a.data.length; i++) { const v = (a.data[i] - 128) / 128; sum += v * v }
      const rms = Math.sqrt(sum / a.data.length)
      // A local muted mic still produces samples, so suppress our own ring when muted.
      const suppressed = id === myId() && muted.value
      if (rms > 0.045 && !suppressed) a.lastAbove = now
      if (now - a.lastAbove < 350) speaking.push(id) // short hangover to avoid flicker
    }
    const prev = speakingIds.value
    if (speaking.length !== prev.length || speaking.some((id) => !prev.includes(id))) speakingIds.value = speaking
    rafId = analysers.size ? requestAnimationFrame(levelLoop) : null
  }

  async function join(voiceId) {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      micError.value = false
    } catch {
      localStream = null
      micError.value = true // presence-only (no mic) — still "connected"
    }
    connected.value = true
    muted.value = false

    // Analyse our own mic so our avatar ring lights up when we talk.
    if (localStream) addAnalyser(myId(), localStream)

    removeSignal = rooms.onSignal(handleSignal)
    // Open/close peer connections as the voice channel's membership changes.
    stopWatch = watch(
      () => rooms.voiceMembers(voiceId).map((m) => m.id).sort().join(','),
      () => reconcile(voiceId),
      { immediate: true }
    )
  }

  function reconcile(voiceId) {
    const ids = rooms.voiceMembers(voiceId).map((m) => m.id).filter((id) => id !== myId())
    // New members: the smaller id initiates (the other side does likewise for us).
    for (const pid of ids) {
      if (!peers.has(pid) && myId() < pid) createPeer(pid, true)
    }
    // Departed members: tear their connection down.
    for (const pid of [...peers.keys()]) {
      if (!ids.includes(pid)) closePeer(pid)
    }
    peerCount.value = peers.size
  }

  function createPeer(peerId, initiator) {
    const pc = new RTCPeerConnection(ICE)
    if (localStream) localStream.getTracks().forEach((track) => pc.addTrack(track, localStream))
    pc.onicecandidate = (e) => {
      if (e.candidate) rooms.sendSignal({ kind: 'ice', from: myId(), to: peerId, candidate: e.candidate })
    }
    pc.ontrack = (e) => attachAudio(peerId, e.streams[0])
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) closePeer(peerId)
    }
    const rec = { pc, audioEl: null }
    peers.set(peerId, rec)
    peerCount.value = peers.size
    if (initiator) {
      pc.createOffer()
        .then(async (offer) => {
          await pc.setLocalDescription(offer)
          rooms.sendSignal({ kind: 'offer', from: myId(), to: peerId, sdp: offer })
        })
        .catch(() => {})
    }
    return rec
  }

  async function handleSignal(msg) {
    if (!msg || msg.to !== myId()) return
    if (msg.kind === 'offer') {
      let rec = peers.get(msg.from) || createPeer(msg.from, false)
      await rec.pc.setRemoteDescription(msg.sdp)
      const answer = await rec.pc.createAnswer()
      await rec.pc.setLocalDescription(answer)
      rooms.sendSignal({ kind: 'answer', from: myId(), to: msg.from, sdp: answer })
    } else if (msg.kind === 'answer') {
      await peers.get(msg.from)?.pc.setRemoteDescription(msg.sdp).catch(() => {})
    } else if (msg.kind === 'ice') {
      try { await peers.get(msg.from)?.pc.addIceCandidate(msg.candidate) } catch { /* ignore */ }
    }
  }

  function attachAudio(peerId, stream) {
    const rec = peers.get(peerId)
    if (!rec) return
    if (!rec.audioEl) {
      const el = new Audio()
      el.autoplay = true
      rec.audioEl = el
    }
    rec.audioEl.srcObject = stream
    rec.audioEl.play?.().catch(() => {})
    // Light this peer's avatar ring when they talk.
    addAnalyser(peerId, stream)
  }

  function closePeer(peerId) {
    const rec = peers.get(peerId)
    if (!rec) return
    try { rec.pc.close() } catch { /* ignore */ }
    if (rec.audioEl) rec.audioEl.srcObject = null
    removeAnalyser(peerId)
    peers.delete(peerId)
    peerCount.value = peers.size
  }

  function leave() {
    stopWatch?.(); stopWatch = null
    removeSignal?.(); removeSignal = null
    for (const pid of [...peers.keys()]) closePeer(pid)
    localStream?.getTracks().forEach((t) => t.stop())
    localStream = null
    analysers.clear()
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    speakingIds.value = []
    connected.value = false
    muted.value = false
    peerCount.value = 0
  }

  function setMuted(value) {
    muted.value = value
    localStream?.getAudioTracks().forEach((t) => { t.enabled = !value })
  }
  function toggleMute() { setMuted(!muted.value) }

  return { connected, muted, micError, peerCount, speakingIds, join, leave, toggleMute, setMuted }
}
