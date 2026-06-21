/**
 * i18n/index.js
 * ----------------------------------------------------------------------------
 * Internationalisation (English + Vietnamese) using vue-i18n in Composition API
 * mode. Only UI chrome is translated — demo content (note bodies, posts, chat)
 * stays as authored, like real user-generated content.
 *
 * The chosen locale is persisted to localStorage (like the theme) and restored
 * on startup. `setLocale()` is the single entry point the language switcher uses.
 */

import { createI18n } from 'vue-i18n'
import en from './messages/en.js'
import vi from './messages/vi.js'

const LOCALE_KEY = 'studysync_locale'
export const SUPPORTED = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'vi', label: 'Tiếng Việt', short: 'VI' }
]

// Default English; restore a saved choice if present.
const saved = localStorage.getItem(LOCALE_KEY)
const initial = SUPPORTED.some((l) => l.code === saved) ? saved : 'en'

export const i18n = createI18n({
  legacy: false, // Composition API mode -> useI18n()
  locale: initial,
  fallbackLocale: 'en',
  messages: { en, vi }
})

/** Switch language and persist the choice. Also reflect it on <html lang>. */
export function setLocale(code) {
  if (!SUPPORTED.some((l) => l.code === code)) return
  i18n.global.locale.value = code
  localStorage.setItem(LOCALE_KEY, code)
  document.documentElement.setAttribute('lang', code)
}

// Apply the initial <html lang> on load.
document.documentElement.setAttribute('lang', initial)
