/**
 * aiService.js — the single interface every component/store uses for "AI".
 * ----------------------------------------------------------------------------
 * It mirrors the project's demo-mode pattern (see supabaseClient.js): a flag,
 * `isAiConfigured`, decides whether to use the real model.
 *
 *   VITE_AI_ENABLED === 'true'  → generative AI via the /api/ai proxy (Gemini).
 *   otherwise                   → the manual, offline rule-based utils.
 *
 * The Gemini KEY is never here — it lives only in the Vercel function. This file
 * just POSTs {task, payload} to /api/ai. Every "tool" method degrades gracefully:
 * if the proxy is missing or errors, it falls back to the manual generator so
 * the app keeps working (including offline / demo / marking).
 *
 * Methods that have NO manual equivalent (chat, rewrite) are only meaningful
 * when isAiConfigured is true — guard their UI with that flag.
 */

import { supabase } from './supabaseClient.js'
import { generateFlashcards as manualFlashcards } from '../utils/flashcardGenerator.js'
import { generateQuiz as manualQuiz } from '../utils/quizGenerator.js'
import { extractKeywords as manualKeywords } from '../utils/keywordExtractor.js'
import { analyzeDifficulty as manualDifficulty } from '../utils/difficultyAnalyzer.js'
import { extractKeySentences } from '../utils/textAnalyzer.js'
import { askSources as manualAskSources } from '../utils/sourceSearch.js'

/** True when the app is wired to the Gemini proxy. Public, safe to read in UI. */
export const isAiConfigured = import.meta.env.VITE_AI_ENABLED === 'true'

/** Attach the current Supabase access token so the proxy can verify the user. */
async function authHeader() {
  try {
    const { data } = (await supabase?.auth?.getSession?.()) || {}
    const token = data?.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

/** POST a task to the proxy. Throws on any non-OK response so callers can fall back. */
async function callAi(task, payload) {
  const resp = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ task, payload })
  })
  if (!resp.ok) {
    const info = await resp.json().catch(() => ({}))
    throw new Error(info.error || `AI request failed (${resp.status})`)
  }
  return resp.json()
}

// ---------------------------------------------------------------------------
// Tools — Gemini when configured, manual utils as the guaranteed fallback.
// Each returns the SAME shape as its manual util so components need no changes.
// ---------------------------------------------------------------------------

/** @returns {Promise<Array<{question:string, answer:string}>>} */
export async function generateFlashcards(content, { max = 12 } = {}) {
  if (isAiConfigured) {
    try {
      const { flashcards } = await callAi('flashcards', { text: content, max })
      if (flashcards?.length) return flashcards.map((c) => ({ ...c, pattern: 'ai' }))
    } catch (e) {
      console.warn('[ai] flashcards fell back to manual:', e.message)
    }
  }
  return manualFlashcards(content, { maxCards: max })
}

/** @returns {Promise<Array<{question:string, options:string[], correctAnswer:number}>>} */
export async function generateQuiz(content, { max = 8 } = {}) {
  if (isAiConfigured) {
    try {
      const { quiz } = await callAi('quiz', { text: content, max })
      if (quiz?.length) return quiz
    } catch (e) {
      console.warn('[ai] quiz fell back to manual:', e.message)
    }
  }
  return manualQuiz(content, { maxQuestions: max })
}

/** @returns {Promise<string[]>} key sentences/points */
export async function summarize(content, { max = 4 } = {}) {
  if (isAiConfigured) {
    try {
      const { summary } = await callAi('summary', { text: content, max })
      if (summary?.length) return summary
    } catch (e) {
      console.warn('[ai] summary fell back to manual:', e.message)
    }
  }
  return extractKeySentences(content, manualKeywords(content, { limit: 15 }), max)
}

/** @returns {Promise<Array<{word:string, count:number, technical:boolean}>>} */
export async function extractKeywords(content, { limit = 12 } = {}) {
  if (isAiConfigured) {
    try {
      const { keywords } = await callAi('keywords', { text: content, limit })
      if (keywords?.length) return keywords
    } catch (e) {
      console.warn('[ai] keywords fell back to manual:', e.message)
    }
  }
  return manualKeywords(content, { limit })
}

/**
 * Generate a concise note title from its content. AI when configured, else a
 * simple heuristic (first sentence, trimmed to a few words).
 * @returns {Promise<string>}
 */
export async function generateTitle(content) {
  if (isAiConfigured) {
    try {
      const { title } = await callAi('title', { text: content })
      if (title?.trim()) return title.trim()
    } catch (e) {
      console.warn('[ai] title fell back to heuristic:', e.message)
    }
  }
  // Heuristic fallback: first sentence → first ~8 words, capitalised.
  const first = String(content || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)[0] || ''
  const words = first.split(' ').filter(Boolean).slice(0, 8).join(' ')
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

/** Difficulty stays deterministic/manual — the heatmap needs its exact metrics. */
export function analyzeDifficulty(content) {
  return manualDifficulty(content)
}

/**
 * Ask-your-sources (RAG). We always retrieve candidate passages locally first
 * (cheap, grounding), then — when AI is on — have Gemini write a grounded answer
 * with citations. When AI is off we return the extractive passages as before.
 *
 * @returns {Promise<{answer:string|null, citations:Array, passages:Array}>}
 */
export async function askSources(question, docs, { limit = 5 } = {}) {
  const passages = manualAskSources(question, docs, { limit: Math.max(limit, 8) })
  if (isAiConfigured && passages.length) {
    try {
      const { answer, citations } = await callAi('ask', {
        question,
        passages: passages.map((p) => ({ source: p.source, text: p.text, docId: p.docId }))
      })
      return { answer, citations: citations || [], passages: passages.slice(0, limit) }
    } catch (e) {
      console.warn('[ai] ask fell back to extractive:', e.message)
    }
  }
  return { answer: null, citations: [], passages: passages.slice(0, limit) }
}

// ---------------------------------------------------------------------------
// Generative-only — no manual equivalent. Guard UI with isAiConfigured.
// ---------------------------------------------------------------------------

/**
 * Multi-turn study chat.
 * @param {Array<{role:'user'|'assistant', content:string}>} messages
 * @param {{context?:string}} opts  optional note text the tutor can reference
 * @returns {Promise<string>}
 */
export async function chat(messages, { context = '' } = {}) {
  const { text } = await callAi('chat', { messages, context })
  return text
}

/**
 * Rewrite/transform a selection.
 * @param {string} text
 * @param {'improve'|'shorten'|'expand'|'fix'|'explain'|'continue'|'translate'} mode
 * @returns {Promise<string>}
 */
export async function rewrite(text, mode = 'improve') {
  const { text: out } = await callAi('rewrite', { text, mode })
  return out
}

export const aiService = {
  isAiConfigured,
  generateFlashcards,
  generateQuiz,
  summarize,
  extractKeywords,
  generateTitle,
  analyzeDifficulty,
  askSources,
  chat,
  rewrite
}

export default aiService
