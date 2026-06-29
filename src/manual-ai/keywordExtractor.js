/**
 * keywordExtractor.js
 * ----------------------------------------------------------------------------
 * Manual keyword extraction (no AI API).
 *
 * Strategy: tokenise -> drop stopwords (EN + VI) and short tokens -> count
 * frequency -> rank. Optionally fold in a small technical-term boost so domain
 * words (e.g. "polymorphism") outrank generic high-frequency words.
 */

import { tokenize } from '../utils/textAnalyzer.js'
import { allStopwords } from '../data/vietnameseStopwords.js'

/**
 * A small dictionary of technical / academic terms. Tokens found here get a
 * frequency boost so they bubble to the top even when mentioned only once or
 * twice. This makes the extractor feel "smart" without any model.
 */
const TECHNICAL_TERMS = new Set([
  'algorithm', 'function', 'variable', 'component', 'reactivity', 'state',
  'inheritance', 'polymorphism', 'encapsulation', 'abstraction', 'interface',
  'recursion', 'complexity', 'hash', 'collision', 'pointer', 'array', 'object',
  'class', 'method', 'framework', 'router', 'database', 'query', 'asynchronous',
  'promise', 'closure', 'prototype', 'middleware', 'authentication', 'token',
  'schema', 'index', 'normalisation', 'concurrency', 'thread', 'heuristic'
])

/**
 * Extract the most important keywords from a body of text.
 *
 * @param {string} text
 * @param {object} [options]
 * @param {number} [options.limit=10]   maximum keywords returned
 * @param {number} [options.minLength=3] ignore tokens shorter than this
 * @returns {Array<{word:string, count:number, technical:boolean}>}
 */
export function extractKeywords(text, options = {}) {
  const { limit = 10, minLength = 3 } = options
  const tokens = tokenize(text)

  // Count frequency of each meaningful token.
  const frequency = new Map()
  for (const token of tokens) {
    if (token.length < minLength) continue
    if (allStopwords.has(token)) continue
    if (/^\d+$/.test(token)) continue // skip pure numbers
    frequency.set(token, (frequency.get(token) || 0) + 1)
  }

  // Convert to array and apply the technical-term boost.
  const ranked = Array.from(frequency.entries()).map(([word, count]) => {
    const technical = TECHNICAL_TERMS.has(word)
    // Boost weight is used only for ordering; `count` stays the true frequency.
    const weight = technical ? count + 2 : count
    return { word, count, technical, weight }
  })

  ranked.sort((a, b) => b.weight - a.weight || b.count - a.count)

  return ranked.slice(0, limit).map(({ word, count, technical }) => ({
    word,
    count,
    technical
  }))
}

/**
 * Convenience helper: return just the keyword strings.
 * @param {string} text
 * @param {number} [limit]
 * @returns {string[]}
 */
export function extractKeywordStrings(text, limit = 10) {
  return extractKeywords(text, { limit }).map((k) => k.word)
}
