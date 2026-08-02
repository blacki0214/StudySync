/**
 * aiService.js — the single interface every component/store uses for AI.
 * ----------------------------------------------------------------------------
 * The AI proxy (/api/ai → an OpenAI-compatible provider) is PRIMARY; the offline
 * rule-based engine in src/manual-ai is the FALLBACK. Every generative method
 * tries the proxy first (when enabled) and, on any failure or when AI is
 * disabled, returns the manual-ai result instead — so the app always produces
 * something.
 *
 *   VITE_AI_ENABLED === 'true'  → provider via /api/ai, falling back to manual-ai.
 *   otherwise                   → manual-ai only.
 *
 * The API KEY lives only in the Vercel function, never here.
 * chat() and rewrite() have NO manual equivalent, so they require the proxy and
 * throw when it's unavailable — guard their UI with isAiConfigured.
 */

import { supabase } from './supabaseClient.js'
import { manualAI } from '../manual-ai/index.js'

/** True when the app is wired to the Gemini proxy. Public, safe to read in UI. */
export const isAiConfigured = import.meta.env.VITE_AI_ENABLED === 'true'

/** Throw early (with a clear message) when AI isn't enabled. For chat/rewrite. */
function ensureAi() {
  if (!isAiConfigured) {
    throw new Error('AI is disabled. Set VITE_AI_ENABLED=true and configure AI_API_KEY.')
  }
}

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
  ensureAi()
  const resp = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ task, payload })
  })
  if (!resp.ok) {
    const info = await resp.json().catch(() => ({}))
    const message = info.error || `AI request failed (${resp.status})`
    console.error(`[ai] ${task} failed → ${message}`)
    throw new Error(message)
  }
  return resp.json()
}

// ---------------------------------------------------------------------------
// Generation — Gemini first, manual-ai fallback. Same return shapes either way.
// ---------------------------------------------------------------------------

/**
 * Flashcards — Gemini first, then the fine-tuned local model (offline, no limit).
 * The rule-based engine is NOT used here: on model failure we surface a clear
 * message rather than return low-quality pattern cards.
 * @returns {Promise<Array<{question:string, answer:string, pattern:string}>>}
 */
export async function generateFlashcards(content, { max = 12 } = {}) {
  if (isAiConfigured) {
    try {
      const { flashcards } = await callAi('flashcards', { text: content, max })
      if (flashcards?.length) return flashcards.map((c) => ({ ...c, pattern: 'ai' }))
    } catch (e) {
      console.warn('[ai] flashcards → local model:', e.message)
    }
  }
  // Offline fallback: the fine-tuned T5 model (rule-based keyword extractor still
  // picks the answers; the model phrases the questions). Replaces manual-ai.
  try {
    const { generateFlashcardsML } = await import('../ml-ai/questionGen.js')
    const cards = await generateFlashcardsML(content, { max })
    if (cards.length) return cards
    throw new Error('The local model produced no cards for this content.')
  } catch (e) {
    console.error('[ai] local flashcard model failed:', e.message)
    throw new Error(
      'Flashcard generation is unavailable right now. The offline model may still ' +
      'be downloading. Please try again in a moment.'
    )
  }
}

/** @returns {Promise<Array<{question:string, options:string[], correctAnswer:number, explanation?:string}>>} */
export async function generateQuiz(content, { max = 8 } = {}) {
  if (isAiConfigured) {
    try {
      const { quiz } = await callAi('quiz', { text: content, max })
      if (quiz?.length) return quiz
    } catch (e) {
      console.warn('[ai] quiz → manual fallback:', e.message)
    }
  }
  return manualAI.generateQuiz(content, { max })
}

/** @returns {Promise<string[]>} key points */
export async function summarize(content, { max = 4 } = {}) {
  if (isAiConfigured) {
    try {
      const { summary } = await callAi('summary', { text: content, max })
      if (summary?.length) return summary
    } catch (e) {
      console.warn('[ai] summary → manual fallback:', e.message)
    }
  }
  return manualAI.summarize(content, { max })
}

/** @returns {Promise<Array<{word:string, count:number, technical:boolean}>>} */
export async function extractKeywords(content, { limit = 12 } = {}) {
  if (isAiConfigured) {
    try {
      const { keywords } = await callAi('keywords', { text: content, limit })
      if (keywords?.length) return keywords
    } catch (e) {
      console.warn('[ai] keywords → manual fallback:', e.message)
    }
  }
  return manualAI.extractKeywords(content, { limit })
}

/** @returns {Promise<string>} a concise note title */
export async function generateTitle(content) {
  if (isAiConfigured) {
    try {
      const { title } = await callAi('title', { text: content })
      if (title?.trim()) return title.trim()
    } catch (e) {
      console.warn('[ai] title → manual fallback:', e.message)
    }
  }
  return manualAI.generateTitle(content)
}

/** Difficulty is deterministic analytics — always the manual engine. */
export function analyzeDifficulty(content) {
  return manualAI.analyzeDifficulty(content)
}

/**
 * Ask-your-sources (RAG). Always retrieves candidate passages locally (grounding).
 * When Gemini is available it writes a grounded answer with citations; otherwise
 * it returns the extractive passages (answer = null).
 * @returns {Promise<{answer:string|null, citations:Array, passages:Array}>}
 */
export async function askSources(question, docs, { limit = 5 } = {}) {
  const passages = manualAI.retrieve(question, docs, { limit: Math.max(limit, 8) })
  if (isAiConfigured && passages.length) {
    try {
      const { answer, citations } = await callAi('ask', {
        question,
        passages: passages.map((p) => ({ source: p.source, text: p.text, docId: p.docId }))
      })
      return { answer, citations: citations || [], passages: passages.slice(0, limit) }
    } catch (e) {
      console.warn('[ai] ask → extractive fallback:', e.message)
    }
  }
  return { answer: null, citations: [], passages: passages.slice(0, limit) }
}

// ---------------------------------------------------------------------------
// Generative-only — no manual equivalent. Require Gemini (throw if disabled).
// ---------------------------------------------------------------------------

/**
 * Multi-turn study chat.
 * @param {Array<{role:'user'|'assistant', content:string}>} messages
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
