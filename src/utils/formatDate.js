/**
 * formatDate.js
 * ----------------------------------------------------------------------------
 * Date/time formatting helpers. Centralised so the whole app shows dates in one
 * consistent style.
 */

/**
 * Human "time ago" string, e.g. "3 minutes ago", "2 days ago".
 * @param {string|number|Date} input
 * @returns {string}
 */
export function timeAgo(input) {
  const date = new Date(input)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (Number.isNaN(seconds)) return ''

  if (seconds < 60) return 'just now'

  const intervals = [
    { label: 'year', secs: 31536000 },
    { label: 'month', secs: 2592000 },
    { label: 'week', secs: 604800 },
    { label: 'day', secs: 86400 },
    { label: 'hour', secs: 3600 },
    { label: 'minute', secs: 60 }
  ]

  for (const { label, secs } of intervals) {
    const count = Math.floor(seconds / secs)
    if (count >= 1) return `${count} ${label}${count > 1 ? 's' : ''} ago`
  }
  return 'just now'
}

/**
 * Friendly absolute date, e.g. "8 Jun 2026".
 * @param {string|number|Date} input
 * @returns {string}
 */
export function formatDate(input) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

/**
 * Friendly date + time, e.g. "8 Jun 2026, 14:30".
 * @param {string|number|Date} input
 * @returns {string}
 */
export function formatDateTime(input) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
