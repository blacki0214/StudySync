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

/**
 * Run several validators and return the first error found, or null if all pass.
 * @param {Array<string|null>} results
 * @returns {string|null}
 */
export function firstError(results) {
  return results.find((r) => r !== null) || null
}
