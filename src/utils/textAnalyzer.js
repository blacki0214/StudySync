/**
 * textAnalyzer.js
 * ----------------------------------------------------------------------------
 * Low-level, dependency-free text processing primitives shared by every
 * "manual AI" feature in StudySync (flashcards, quizzes, difficulty, summary).
 *
 * Everything here is plain rule-based JavaScript — NO external AI API is used.
 * Keeping these primitives in one place means the higher-level generators stay
 * small and the parsing rules are tested/tuned in a single location.
 */

/**
 * Split a block of text into individual sentences.
 *
 * We split on sentence-ending punctuation (. ! ?) followed by whitespace, then
 * trim and drop empties. Abbreviation handling is intentionally light because
 * student notes rarely contain "e.g." style traps, and over-engineering this
 * hurts readability.
 *
 * @param {string} text
 * @returns {string[]} clean, non-empty sentences
 */
export function splitSentences(text) {
  if (!text) return []
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * Break text into lowercase word tokens.
 * Unicode-aware (\p{L}) so Vietnamese diacritics are preserved.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  if (!text) return []
  const matches = text.toLowerCase().match(/[\p{L}\p{N}]+/gu)
  return matches || []
}

/**
 * Count words in a piece of text.
 * @param {string} text
 * @returns {number}
 */
export function wordCount(text) {
  return tokenize(text).length
}

/**
 * Estimate the number of syllables in an English word.
 * Used by difficulty analysis as a readability signal. This is a well-known
 * heuristic: count vowel groups, subtract a silent trailing "e", clamp to >= 1.
 *
 * @param {string} word
 * @returns {number}
 */
export function countSyllables(word) {
  if (!word) return 0
  word = word.toLowerCase().replace(/[^a-z]/g, '')
  if (word.length <= 3) return 1
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
  word = word.replace(/^y/, '')
  const groups = word.match(/[aeiouy]{1,2}/g)
  return groups ? groups.length : 1
}

/**
 * Average sentence length (in words) across the text. A higher number signals
 * denser, more complex writing.
 *
 * @param {string} text
 * @returns {number}
 */
export function averageSentenceLength(text) {
  const sentences = splitSentences(text)
  if (sentences.length === 0) return 0
  const totalWords = sentences.reduce((sum, s) => sum + wordCount(s), 0)
  return totalWords / sentences.length
}

/**
 * Score every sentence by how many "important" keywords it contains, then
 * return the top N sentences in their ORIGINAL order. This is the engine behind
 * the StudySummary feature (extractive summarisation, no AI API).
 *
 * The algorithm:
 *   1. Build a frequency map of the supplied keywords for fast scoring.
 *   2. Score each sentence = sum of keyword weights it contains, normalised by
 *      sqrt(length) so very long sentences don't automatically win.
 *   3. Pick the top N scoring sentences, then re-sort them by their position so
 *      the summary reads in document order.
 *
 * @param {string} text
 * @param {Array<{word:string, count:number}>} keywords ranked keywords
 * @param {number} maxSentences
 * @returns {string[]}
 */
export function extractKeySentences(text, keywords, maxSentences = 4) {
  const sentences = splitSentences(text)
  if (sentences.length <= maxSentences) return sentences

  // Map keyword -> weight (its frequency) for O(1) lookups.
  const weights = new Map()
  keywords.forEach((k) => weights.set(k.word, k.count))

  const scored = sentences.map((sentence, index) => {
    const tokens = tokenize(sentence)
    let score = 0
    tokens.forEach((t) => {
      if (weights.has(t)) score += weights.get(t)
    })
    // Normalise so long sentences are not unfairly favoured.
    const normalised = score / Math.sqrt(tokens.length || 1)
    return { sentence, index, score: normalised }
  })

  return scored
    .sort((a, b) => b.score - a.score) // best first
    .slice(0, maxSentences) // keep top N
    .sort((a, b) => a.index - b.index) // restore reading order
    .map((s) => s.sentence)
}
