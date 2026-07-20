/**
 * useFocusTracker.js
 * ----------------------------------------------------------------------------
 * Measures how long the user is actually working on a study surface and files
 * the result with focusStore. Drop one call into any study view:
 *
 *   useFocusTracker('notes')
 *
 * What counts as focus:
 *   • the component is mounted, AND
 *   • the tab is visible (switching tabs pauses the clock), AND
 *   • there was input within IDLE_TIMEOUT_MS (walking away stops the clock).
 *
 * Time is flushed on unmount, on tab-hide and periodically, so a closed tab or
 * a crash loses at most one flush interval rather than the whole session.
 */

import { onMounted, onBeforeUnmount } from 'vue'
import { useFocusStore, IDLE_TIMEOUT_MS } from '../stores/focusStore.js'

const FLUSH_EVERY_MS = 60 * 1000
const ACTIVITY_EVENTS = ['keydown', 'pointerdown', 'pointermove', 'wheel', 'scroll']

export function useFocusTracker(surface) {
  const focus = useFocusStore()

  let segmentStart = null   // when the current active stretch began
  let lastActivity = Date.now()
  let timer = null

  /** Bank whatever is on the clock and reset it. */
  function flush() {
    if (segmentStart == null) return
    // Never bank past the idle cutoff — cap at the last real interaction.
    const end = Math.min(Date.now(), lastActivity + IDLE_TIMEOUT_MS)
    const ms = end - segmentStart
    if (ms > 0) focus.recordFocus(surface, ms, segmentStart)
    segmentStart = null
  }

  function resume() {
    if (segmentStart == null && document.visibilityState === 'visible') {
      segmentStart = Date.now()
      lastActivity = Date.now()
    }
  }

  function onActivity() {
    // Coming back after an idle gap starts a fresh segment rather than
    // retroactively counting the time spent away.
    if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) flush()
    lastActivity = Date.now()
    resume()
  }

  function onVisibility() {
    if (document.visibilityState === 'visible') resume()
    else flush()
  }

  onMounted(() => {
    focus.ensureLoaded()
    focus.prune()
    resume()

    timer = setInterval(() => {
      // Periodic flush + restart, so long sessions survive an abrupt close.
      flush()
      if (Date.now() - lastActivity < IDLE_TIMEOUT_MS) resume()
    }, FLUSH_EVERY_MS)

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', flush)
    for (const e of ACTIVITY_EVENTS) {
      window.addEventListener(e, onActivity, { passive: true })
    }
  })

  onBeforeUnmount(() => {
    flush()
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('beforeunload', flush)
    for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, onActivity)
  })
}
