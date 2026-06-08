/**
 * flashcardGenerator.js
 * ----------------------------------------------------------------------------
 * Manual flashcard generation from note content (no AI API).
 *
 * The generator scans each sentence for well-known DEFINITION PATTERNS and turns
 * matches into question/answer pairs. Each pattern knows how to phrase its own
 * question, e.g. "X is used for Y" -> "What is X used for?" / "Y".
 *
 * Example:
 *   Input : "Vue Router is used for page navigation in Vue applications."
 *   Output: { question: "What is Vue Router used for?",
 *             answer  : "page navigation in Vue applications" }
 */

import { splitSentences } from './textAnalyzer.js'

/**
 * Each rule has:
 *  - regex   : capturing groups (1) = subject/term, (2) = definition
 *  - question: builds the question text from the captured subject
 *  - keyword : the trigger phrase, kept for difficulty tagging / debugging
 *
 * Order matters: more specific patterns ("is used for") are tried before the
 * generic "is" pattern so we pick the most descriptive phrasing.
 */
const DEFINITION_PATTERNS = [
  {
    keyword: 'is used for',
    regex: /^(.{2,60}?)\s+(?:is|are)\s+used\s+(?:for|to)\s+(.+)$/i,
    question: (subject) => `What is ${subject} used for?`
  },
  {
    keyword: 'refers to',
    regex: /^(.{2,60}?)\s+refers?\s+to\s+(.+)$/i,
    question: (subject) => `What does ${subject} refer to?`
  },
  {
    keyword: 'means',
    regex: /^(.{2,60}?)\s+means?\s+(?:that\s+)?(.+)$/i,
    question: (subject) => `What does ${subject} mean?`
  },
  {
    keyword: 'allows',
    regex: /^(.{2,60}?)\s+allows?\s+(.+)$/i,
    question: (subject) => `What does ${subject} allow?`
  },
  {
    keyword: 'describes',
    regex: /^(.{2,60}?)\s+describes?\s+(.+)$/i,
    question: (subject) => `What does ${subject} describe?`
  },
  {
    // Generic copula pattern handled LAST. Excludes "is used/refers/means" which
    // are already covered above, and requires a reasonably short subject so we
    // don't capture rambling clauses.
    keyword: 'is / are',
    regex: /^(.{2,50}?)\s+(?:is|are)\s+(?!used|the\s+system\s+that)(.+)$/i,
    question: (subject) => `What is ${subject}?`
  }
]

/**
 * Tidy a captured fragment: strip trailing punctuation and surrounding spaces.
 * @param {string} value
 * @returns {string}
 */
function clean(value) {
  return value.replace(/\s+/g, ' ').replace(/[.,;:\s]+$/, '').trim()
}

/**
 * Capitalise the first character of a fragment for nicer answers.
 * @param {string} value
 */
function capitalise(value) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * Generate flashcards from raw note content.
 *
 * @param {string} content
 * @param {object} [options]
 * @param {number} [options.maxCards=10]
 * @returns {Array<{question:string, answer:string, pattern:string}>}
 */
export function generateFlashcards(content, options = {}) {
  const { maxCards = 10 } = options
  const sentences = splitSentences(content)
  const cards = []
  const seenQuestions = new Set()

  for (const sentence of sentences) {
    if (cards.length >= maxCards) break

    for (const pattern of DEFINITION_PATTERNS) {
      const match = sentence.match(pattern.regex)
      if (!match) continue

      const subject = clean(match[1])
      const definition = clean(match[2])

      // Skip degenerate matches (too-short subject or empty answer).
      if (subject.length < 2 || definition.length < 3) continue

      const question = pattern.question(subject)
      if (seenQuestions.has(question.toLowerCase())) break
      seenQuestions.add(question.toLowerCase())

      cards.push({
        question,
        answer: capitalise(definition),
        pattern: pattern.keyword
      })
      break // one card per sentence: stop at the first matching pattern
    }
  }

  return cards
}
