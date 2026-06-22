/**
 * platform.js — tiny OS detection so keyboard hints match the device:
 * macOS shows the ⌘ (Command) symbol; Windows/Linux show "Ctrl".
 */
const ua = typeof navigator !== 'undefined'
  ? (navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '')
  : ''

export const isMac = /Mac|iPhone|iPod|iPad/i.test(ua)

/** The command-modifier label for the current OS ('⌘' on Mac, 'Ctrl' elsewhere). */
export const cmdKey = isMac ? '⌘' : 'Ctrl'

/** A full shortcut hint like '⌘K' (Mac) or 'Ctrl K' (Windows/Linux). */
export function shortcut(key) {
  return isMac ? `${cmdKey}${key}` : `${cmdKey} ${key}`
}
