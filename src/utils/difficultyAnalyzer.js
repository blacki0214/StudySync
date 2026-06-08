/**
 * difficultyAnalyzer.js
 * ----------------------------------------------------------------------------
 * Manual difficulty estimation for a note (no AI API).
 *
 * We combine four independent signals into a single weighted score, then map
 * the score onto Easy / Medium / Hard. The function also returns a human
 * explanation and the raw metrics so the UI (DifficultyHeatmap) can visualise
 * each contributing factor.
 *
 * Signals:
 *   1. Average sentence length  — longer sentences = denser material.
 *   2. Technical keyword density — proportion of domain terms.
 *   3. Long/unfamiliar words    — share of words with 3+ syllables.
 *   4. Overall content length   — more material to absorb = harder.
 */

import {
  splitSentences,
  tokenize,
  averageSentenceLength,
  countSyllables,
  wordCount
} from './textAnalyzer.js'
import { extractKeywords } from './keywordExtractor.js'

/**
 * Map any raw value onto a 0..1 score using a soft ceiling. Values at or above
 * `ceiling` saturate to 1. Keeps each signal comparable before weighting.
 */
function normalise(value, ceiling) {
  return Math.min(value / ceiling, 1)
}

/**
 * Analyse note difficulty.
 *
 * @param {string} content
 * @returns {{
 *   level: 'Easy'|'Medium'|'Hard',
 *   score: number,                // 0..100
 *   explanation: string,
 *   metrics: object
 * }}
 */
export function analyzeDifficulty(content) {
  const tokens = tokenize(content)
  const totalWords = tokens.length

  // Guard: empty note is trivially "Easy".
  if (totalWords === 0) {
    return {
      level: 'Easy',
      score: 0,
      explanation: 'This note is empty, so there is nothing to study yet.',
      metrics: { totalWords: 0, avgSentenceLength: 0, technicalCount: 0, longWordRatio: 0 }
    }
  }

  // --- Signal 1: average sentence length ---------------------------------
  const avgSentenceLength = averageSentenceLength(content)
  const sentenceScore = normalise(avgSentenceLength, 25) // ~25 words/sentence = very dense

  // --- Signal 2: technical keyword density -------------------------------
  const keywords = extractKeywords(content, { limit: 30 })
  const technicalCount = keywords.filter((k) => k.technical).length
  const technicalScore = normalise(technicalCount, 8)

  // --- Signal 3: long / unfamiliar word ratio ----------------------------
  const longWords = tokens.filter((t) => countSyllables(t) >= 3).length
  const longWordRatio = longWords / totalWords
  const longWordScore = normalise(longWordRatio, 0.25) // 25% long words = hard

  // --- Signal 4: overall content length ----------------------------------
  const lengthScore = normalise(totalWords, 250)

  // Weighted blend. Weights sum to 1. Sentence complexity and technical density
  // matter most for "feels hard to study".
  const score =
    sentenceScore * 0.3 +
    technicalScore * 0.3 +
    longWordScore * 0.25 +
    lengthScore * 0.15

  const score100 = Math.round(score * 100)

  let level
  if (score100 < 35) level = 'Easy'
  else if (score100 < 65) level = 'Medium'
  else level = 'Hard'

  const explanation = buildExplanation(level, {
    avgSentenceLength,
    technicalCount,
    longWordRatio,
    totalWords
  })

  return {
    level,
    score: score100,
    explanation,
    metrics: {
      totalWords,
      sentenceCount: splitSentences(content).length,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      technicalCount,
      longWordRatio: Math.round(longWordRatio * 100) / 100,
      wordCount: wordCount(content)
    }
  }
}

/**
 * Produce a plain-language reason for the assigned level so students understand
 * WHY a note was rated the way it was.
 */
function buildExplanation(level, m) {
  const parts = []
  parts.push(
    m.avgSentenceLength > 18
      ? 'sentences are long and information-dense'
      : m.avgSentenceLength > 12
        ? 'sentences are moderately long'
        : 'sentences are short and easy to follow'
  )
  parts.push(
    m.technicalCount >= 5
      ? `it contains many technical terms (${m.technicalCount})`
      : m.technicalCount > 0
        ? `it contains a few technical terms (${m.technicalCount})`
        : 'it uses mostly everyday vocabulary'
  )
  if (m.longWordRatio > 0.18) parts.push('a high share of long words')
  parts.push(`the note is ${m.totalWords} words long`)

  return `Rated ${level} because ${parts.join(', ')}.`
}
