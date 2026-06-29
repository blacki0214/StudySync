/**
 * aiService.js — the single interface every component/store uses for AI.
 * ----------------------------------------------------------------------------
 * GEMINI-ONLY. All generative features go through the /api/ai proxy (Gemini).
 * There is no rule-based fallback anymore: if AI is not enabled or a request
 * fails, the methods throw so the UI can show a clear message instead of
 * silently producing lower-quality "manual" output.
 *
 *   VITE_AI_ENABLED === 'true'  → AI features are on (proxy must be reachable).
 *   otherwise                   → AI features are disabled; callers show a notice.
 *
 * The Gemini KEY lives only in the Vercel function, never here. The only
 * rule-based code still used is sourceSearch — but purely as RETRIEVAL to
 * ground the AI answer (RAG), not to generate study material.
 */

import { supabase } from './supabaseClient.js'
import { askSources as retrievePassages } from '../utils/sourceSearch.js'

/** True when the app is wired to the Gemini proxy. Public, safe to read in UI. */
export const isAiConfigured = import.meta.env.VITE_AI_ENABLED === 'true'

/** Throw early (with a clear message) when AI isn't enabled. */
function ensureAi() {
  if (!isAiConfigured) {
    throw new Error('AI is disabled. Set VITE_AI_ENABLED=true and configure GEMINI_API_KEY.')
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

/** POST a task to the proxy. Throws on any non-OK response. */
async function callAi(task, payload) {
  ensureAi()
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
// Generation — all Gemini. Each throws if AI is disabled or the request fails.
// ---------------------------------------------------------------------------

/** @returns {Promise<Array<{question:string, answer:string}>>} */
export async function generateFlashcards(content, { max = 12 } = {}) {
  const { flashcards } = await callAi('flashcards', { text: content, max })
  return (flashcards || []).map((c) => ({ ...c, pattern: 'ai' }))
}

/** @returns {Promise<Array<{question:string, options:string[], correctAnswer:number, explanation:string}>>} */
export async function generateQuiz(content, { max = 8 } = {}) {
  const { quiz } = await callAi('quiz', { text: content, max })
  return quiz || []
}

/** @returns {Promise<string[]>} key points */
export async function summarize(content, { max = 4 } = {}) {
  const { summary } = await callAi('summary', { text: content, max })
  return summary || []
}

/** @returns {Promise<Array<{word:string, count:number, technical:boolean}>>} */
export async function extractKeywords(content, { limit = 12 } = {}) {
  const { keywords } = await callAi('keywords', { text: content, limit })
  return keywords || []
}

/** @returns {Promise<string>} a concise note title */
export async function generateTitle(content) {
  const { title } = await callAi('title', { text: content })
  return (title || '').trim()
}

/**
 * Ask-your-sources (RAG). Retrieves candidate passages locally (grounding only),
 * then has Gemini write a grounded answer with citations.
 * @returns {Promise<{answer:string, citations:Array, passages:Array}>}
 */
export async function askSources(question, docs, { limit = 5 } = {}) {
  ensureAi()
  const passages = retrievePassages(question, docs, { limit: Math.max(limit, 8) })
  if (!passages.length) return { answer: '', citations: [], passages: [] }
  const { answer, citations } = await callAi('ask', {
    question,
    passages: passages.map((p) => ({ source: p.source, text: p.text, docId: p.docId }))
  })
  return { answer, citations: citations || [], passages: passages.slice(0, limit) }
}

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
  askSources,
  chat,
  rewrite
}

export default aiService
