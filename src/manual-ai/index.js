/**
 * manual-ai — the offline, rule-based "AI" engine.
 * ----------------------------------------------------------------------------
 * This folder is a self-contained module: no external API, no network. It is
 * the FALLBACK the app uses when the Gemini API is unavailable (not configured,
 * rate-limited, or erroring). The app never imports the individual generators
 * directly — it consumes this single facade, whose method names + return shapes
 * match aiService (the Gemini path), so the two are interchangeable.
 *
 *   app → aiService → (Gemini API)  ── falls back to ──►  manual-ai (this module)
 */

import { generateFlashcards as makeFlashcards } from './flashcardGenerator.js'
import { generateQuiz as makeQuiz } from './quizGenerator.js'
import { extractKeywords as makeKeywords } from './keywordExtractor.js'
import { analyzeDifficulty as makeDifficulty } from './difficultyAnalyzer.js'
import { askSources as retrieve } from './sourceSearch.js'
import { extractKeySentences } from '../utils/textAnalyzer.js'

/** Flashcards — same shape as the Gemini path: [{ question, answer, pattern }]. */
function generateFlashcards(content, { max = 12 } = {}) {
  return makeFlashcards(content, { maxCards: max })
}

/** Quiz — [{ question, options, correctAnswer }] (no explanation offline). */
function generateQuiz(content, { max = 8 } = {}) {
  return makeQuiz(content, { maxQuestions: max })
}

/** Key-point summary — string[]. */
function summarize(content, { max = 4 } = {}) {
  const keywords = makeKeywords(content, { limit: 15 })
  return extractKeySentences(content, keywords, max)
}

/** Keywords — [{ word, count, technical }]. */
function extractKeywords(content, { limit = 12 } = {}) {
  return makeKeywords(content, { limit })
}

/** Heuristic title: first sentence, trimmed to a few words. */
function generateTitle(content) {
  const first = String(content || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)[0] || ''
  const words = first.split(' ').filter(Boolean).slice(0, 8).join(' ')
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

/** Difficulty analysis — { level, score, explanation, metrics }. */
function analyzeDifficulty(content) {
  return makeDifficulty(content)
}

/**
 * Extractive "ask your sources": no generation, just the most relevant cited
 * passages. Shape matches aiService.askSources (answer is null offline).
 * @returns {{ answer:null, citations:[], passages:Array }}
 */
function askSources(question, docs, { limit = 5 } = {}) {
  const passages = retrieve(question, docs, { limit })
  return { answer: null, citations: [], passages }
}

export const manualAI = {
  generateFlashcards,
  generateQuiz,
  summarize,
  extractKeywords,
  generateTitle,
  analyzeDifficulty,
  askSources,
  // Raw passage retrieval — used by aiService to GROUND the Gemini answer (RAG).
  retrieve: (question, docs, opts = {}) => retrieve(question, docs, opts)
}

export default manualAI
