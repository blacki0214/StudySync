/**
 * validation.js
 * ----------------------------------------------------------------------------
 * Small, reusable form validators used by the auth and note forms. Each returns
 * either null (valid) or a string error message, which makes them trivial to
 * compose in a component's computed properties.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email) {
  if (!email) return 'Email is required.'
  if (!EMAIL_RE.test(email)) return 'Please enter a valid email address.'
  return null
}

export function validatePassword(password) {
  if (!password) return 'Password is required.'
  if (password.length < 6) return 'Password must be at least 6 characters.'
  return null
}

export function validateRequired(value, field = 'This field') {
  if (!value || !String(value).trim()) return `${field} is required.`
  return null
}

export function validateFullName(name) {
  if (!name || !name.trim()) return 'Full name is required.'
  if (name.trim().length < 2) return 'Full name is too short.'
  return null
}

export function validatePhone(phone) {
  if (!phone || !phone.trim()) return 'Phone number is required.'
  const cleaned = phone.replace(/[\s\-().]/g, '')
  if (!/^\+?\d{8,15}$/.test(cleaned)) return 'Please enter a valid phone number.'
  return null
}

/**
 * Rough password strength estimate for the signup meter.
 * @returns {{ score: 0|1|2|3|4, key: string }} key maps to an i18n label.
 */
export function passwordStrength(pw) {
  if (!pw) return { score: 0, key: 'weak' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (pw.length < 6) score = 0
  const key = ['weak', 'weak', 'fair', 'good', 'strong'][score]
  return { score, key }
}

/**
 * Run several validators and return the first error found, or null if all pass.
 * @param {Array<string|null>} results
 * @returns {string|null}
 */
export function firstError(results) {
  return results.find((r) => r !== null) || null
}
