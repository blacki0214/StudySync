/**
 * deckService.js
 * ----------------------------------------------------------------------------
 * Persists flashcard decks. Mirrors the demo-mode pattern: when Supabase is
 * configured it inserts into `decks` + `deck_cards`; otherwise it builds a
 * local deck object so "Save as deck" still works offline (and for marking).
 *
 * Returns the deck in the shape contentStore/FlashcardsView expect:
 *   { id, name, subject_code, subject, color, due, total, cards: [{question, answer, position}] }
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'

function localId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * @param {object} input
 * @param {string} input.name
 * @param {string} [input.subjectCode]
 * @param {string} [input.color]
 * @param {string} [input.ownerId]  creator id — decks are scoped to their owner
 * @param {Array<{question:string, answer:string}>} input.cards
 * @returns {Promise<object>} the created deck (contentStore shape)
 */
export async function createDeck({ name, subjectCode = '', color = 'grad-blue', ownerId = null, cards = [] }) {
  const clean = cards
    .filter((c) => c && c.question && c.answer)
    .map((c, i) => ({ question: c.question, answer: c.answer, position: i }))

  // Demo mode: synthesise a local deck so the UI works without a backend.
  if (!isSupabaseConfigured || !supabase) {
    return {
      id: localId('deck'),
      owner_id: ownerId,
      name,
      subject_code: subjectCode,
      subject: subjectCode,
      color,
      due: 0,
      total: clean.length,
      cards: clean.map((c) => ({ id: localId('card'), ...c }))
    }
  }

  // Live: insert the deck, then its cards (deck_cards cascades on delete).
  const { data: deck, error } = await supabase
    .from('decks')
    .insert({ name, subject_code: subjectCode || null, color, owner_id: ownerId, due: 0, total: clean.length })
    .select()
    .single()
  if (error) throw error

  let savedCards = []
  if (clean.length) {
    const { data, error: cardsError } = await supabase
      .from('deck_cards')
      .insert(clean.map((c) => ({ ...c, deck_id: deck.id })))
      .select()
    if (cardsError) throw cardsError
    savedCards = (data || []).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  }

  return { ...deck, subject: deck.subject_code, cards: savedCards }
}

export const deckService = { createDeck }
export default deckService
