/**
 * joinCode.js — generate a short, human-friendly class join code.
 * Uses Crockford-ish base32 (no 0/O/1/I) so codes are easy to read and type.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateJoinCode(length = 6) {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return out
}
