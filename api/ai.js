/**
 * api/ai.js — Vercel Serverless Function (the AI proxy).
 * ----------------------------------------------------------------------------
 * The browser must NEVER see the API key (anything in the Vite bundle is
 * public), so all model calls go through this server-side endpoint. The key
 * lives in the Vercel env var AI_API_KEY and never leaves the server.
 *
 *   Browser (src/services/aiService.js)  ──POST {task, payload}──►  this fn  ──►  provider
 *
 * Provider: an OpenAI-compatible chat-completions endpoint (default ShopAIKey,
 * https://api.shopaikey.com/v1). Any OpenAI-compatible gateway works — just set
 * AI_BASE_URL, AI_MODEL and AI_API_KEY. This keeps the frontend contract
 * unchanged: the same {task, payload} in, the same typed JSON out, so
 * aiService, manual-ai and the offline T5 fallback need no changes.
 *
 * Tasks: flashcards | quiz | summary | keywords | ask | chat | rewrite.
 * Structured tasks use JSON mode (response_format) plus an explicit shape in
 * the prompt, so the frontend receives typed objects that match the existing
 * manual-util shapes exactly.
 *
 * Optional auth: if SUPABASE_URL + SUPABASE_ANON_KEY are set in the Vercel env,
 * the caller's Supabase access token is verified, so only logged-in users can
 * spend your credit. If they aren't set, the endpoint stays open (demo).
 *
 * Local dev: plain `vite` does NOT run this file. Use `vercel dev` to exercise
 * the AI features locally; otherwise aiService falls back to the manual utils.
 */

const BASE_URL = (process.env.AI_BASE_URL || 'https://api.shopaikey.com/v1').replace(/\/+$/, '')
const MODEL = process.env.AI_MODEL || 'gpt-4o-mini'
const API_KEY = process.env.AI_API_KEY || process.env.SHOPAIKEY_API_KEY

// Keep prompts (and cost) bounded — notes can be huge.
const MAX_INPUT_CHARS = 12000
const clip = (s) => String(s || '').slice(0, MAX_INPUT_CHARS)

// ---------------------------------------------------------------------------
// Chat-completions call (OpenAI-compatible)
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Default output cap. IMPORTANT: this gateway pre-reserves quota per request
// from the model's FULL max output when max_tokens is omitted, which trips an
// intermittent "insufficient_quota" guard even with credit. Always sending a
// bounded max_tokens avoids that (and caps cost).
const DEFAULT_MAX_TOKENS = Number(process.env.AI_MAX_TOKENS) || 1024

// Abort each upstream attempt after this long (a hung channel otherwise waits
// for Cloudflare's ~100s 524). Two attempts stay within a 60s Vercel budget.
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 28000
const MAX_ATTEMPTS = 2

/**
 * @param {Array<{role:'system'|'user'|'assistant', content:string}>} messages
 * @param {{ json?: boolean, temperature?: number, maxTokens?: number }} opts
 * @returns {Promise<string>} the assistant message content
 */
async function callChat(messages, { json = false, temperature = 0.4, maxTokens } = {}) {
  const body = {
    model: MODEL,
    messages,
    temperature,
    max_tokens: maxTokens || DEFAULT_MAX_TOKENS
  }
  // JSON mode requires the literal word "json" somewhere in the messages, or
  // stricter upstream channels reject the request. Our task prompts include it.
  if (json) body.response_format = { type: 'json_object' }

  // The gateway load-balances across upstream channels; some hang (Cloudflare
  // 524 after ~100s) or return a transient 5xx. Abort each attempt early so a
  // hung channel doesn't blow the Vercel function budget, then retry once on a
  // (hopefully healthier) channel. A 4xx (quota/auth/bad-request) is terminal —
  // fail fast so the client falls back to the offline model.
  const RETRYABLE = new Set([500, 502, 503, 504, 524])
  let lastDetail = ''
  let lastStatus = 0
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const resp = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${API_KEY}`
        },
        body: JSON.stringify(body),
        signal: ctrl.signal
      })
      if (resp.ok) {
        const data = await resp.json()
        return String(data?.choices?.[0]?.message?.content || '').trim()
      }
      lastStatus = resp.status
      lastDetail = await resp.text().catch(() => '')
      if (!RETRYABLE.has(resp.status) || attempt === MAX_ATTEMPTS - 1) break
    } catch (e) {
      // Timeout abort or network error → treat as a gateway timeout and retry.
      lastStatus = 504
      lastDetail = e?.name === 'AbortError' ? `timeout after ${TIMEOUT_MS}ms` : String(e?.message || e)
      if (attempt === MAX_ATTEMPTS - 1) break
    } finally {
      clearTimeout(timer)
    }
    await sleep(400)
  }
  const err = new Error(`AI ${lastStatus} (model ${MODEL}): ${lastDetail.slice(0, 400)}`)
  err.status = lastStatus
  throw err
}

// Build a system+user message pair (the common case).
const turns = (system, user) => [
  { role: 'system', content: system },
  { role: 'user', content: user }
]

// Parse a JSON response defensively (model occasionally wraps it in prose).
function parseJson(text, fallback) {
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        /* fall through */
      }
    }
    return fallback
  }
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
const LANG_RULE =
  'Always answer in the SAME language as the study material (English or Vietnamese). Do not invent facts that are not supported by the material.'

async function taskFlashcards({ text, max = 12 }) {
  const system = `You are a study assistant that writes high-quality flashcards from a student's notes. Each card tests ONE fact: a clear, specific question and a concise answer (a phrase or single sentence). Avoid yes/no questions and duplicates. ${LANG_RULE} Return ONLY valid json of the exact shape {"flashcards":[{"question":"...","answer":"..."}]}.`
  const out = await callChat(
    turns(system, `Create up to ${max} flashcards (as json) from these notes:\n\n${clip(text)}`),
    { json: true, temperature: 0.3, maxTokens: 1500 }
  )
  const parsed = parseJson(out, { flashcards: [] })
  return { flashcards: (parsed.flashcards || []).slice(0, max) }
}

async function taskQuiz({ text, max = 8 }) {
  const system = `You are a study assistant that writes multiple-choice quiz questions from a student's notes. Each question has EXACTLY 4 options, exactly one correct. Distractors must be plausible and drawn from the same topic. "correctAnswer" is the 0-based index of the correct option. "explanation" is one or two sentences saying why the correct option is right (and, if helpful, why a tempting wrong one is not). ${LANG_RULE} Return ONLY valid json of the exact shape {"quiz":[{"question":"...","options":["a","b","c","d"],"correctAnswer":0,"explanation":"..."}]}.`
  const out = await callChat(
    turns(system, `Write up to ${max} multiple-choice questions (as json) from these notes:\n\n${clip(text)}`),
    { json: true, temperature: 0.4, maxTokens: 2000 }
  )
  const parsed = parseJson(out, { quiz: [] })
  // Keep only well-formed 4-option questions with a valid answer index.
  const quiz = (parsed.quiz || [])
    .filter((q) => Array.isArray(q.options) && q.options.length === 4)
    .map((q) => ({
      question: q.question,
      options: q.options,
      correctAnswer: Math.max(0, Math.min(3, Number(q.correctAnswer) || 0)),
      explanation: q.explanation || ''
    }))
    .slice(0, max)
  return { quiz }
}

async function taskSummary({ text, max = 4 }) {
  const system = `You summarise study notes into the ${max} most important points. Each point is one short, self-contained sentence a student can revise from. ${LANG_RULE} Return ONLY valid json of the exact shape {"summary":["point one","point two"]}.`
  const out = await callChat(
    turns(system, `Summarise these notes (as json) into up to ${max} key points:\n\n${clip(text)}`),
    { json: true, temperature: 0.3, maxTokens: 600 }
  )
  const parsed = parseJson(out, { summary: [] })
  return { summary: (parsed.summary || []).slice(0, max) }
}

async function taskKeywords({ text, limit = 12 }) {
  const system = `You extract the most important keywords/terms from study notes. Return single words or short phrases. Mark "technical": true for domain/academic terms, false for everyday words. ${LANG_RULE} Return ONLY valid json of the exact shape {"keywords":[{"word":"...","technical":true}]}.`
  const out = await callChat(
    turns(system, `Extract up to ${limit} key terms (as json) from these notes:\n\n${clip(text)}`),
    { json: true, temperature: 0.2, maxTokens: 500 }
  )
  const parsed = parseJson(out, { keywords: [] })
  const haystack = String(text || '').toLowerCase()
  // Synthesise the `count` the UI expects by counting occurrences in the source.
  const keywords = (parsed.keywords || []).slice(0, limit).map((k) => {
    const word = String(k.word || '').trim()
    const matches = word ? haystack.split(word.toLowerCase()).length - 1 : 0
    return { word, count: Math.max(1, matches), technical: !!k.technical }
  })
  return { keywords }
}

async function taskTitle({ text }) {
  const system = `You write a short, specific title for a study note based on its content. 3-8 words, descriptive, no surrounding quotes, no trailing punctuation. ${LANG_RULE} Return ONLY valid json of the exact shape {"title":"..."}.`
  const out = await callChat(
    turns(system, `Write a title (as json) for this note:\n\n${clip(text)}`),
    { json: true, temperature: 0.4, maxTokens: 60 }
  )
  const parsed = parseJson(out, { title: '' })
  return { title: String(parsed.title || '').replace(/^["'\s]+|["'\s.]+$/g, '') }
}

async function taskAsk({ question, passages = [] }) {
  const system = `You answer a student's question USING ONLY the provided source passages. Cite the sources you used. If the passages do not contain the answer, say so plainly instead of guessing. ${LANG_RULE} Return ONLY valid json of the exact shape {"answer":"...","citations":[{"source":"...","quote":"..."}]}.`
  const sources = passages
    .map((p, i) => `[${i + 1}] (${p.source || 'source'}) ${clip(p.text)}`)
    .join('\n\n')
  const out = await callChat(
    turns(system, `Question: ${question}\n\nAnswer as json using these source passages:\n${sources}`),
    { json: true, temperature: 0.2, maxTokens: 1000 }
  )
  return parseJson(out, { answer: '', citations: [] })
}

async function taskChat({ messages = [], context = '' }) {
  const system =
    `You are StudySync's study tutor: friendly, accurate and concise. Explain clearly, use examples, and prefer short paragraphs or bullet points. ${LANG_RULE}` +
    (context ? `\n\nThe student is working on this note:\n${clip(context)}` : '')
  const chatMessages = [
    { role: 'system', content: system },
    ...messages
      .filter((m) => m && m.content)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content)
      }))
  ]
  const text = await callChat(chatMessages, { temperature: 0.6, maxTokens: 1500 })
  return { text }
}

const REWRITE_RULES = {
  improve: 'Rewrite to be clearer and better-written, keeping the meaning and length similar.',
  shorten: 'Make this more concise while keeping the key information.',
  expand: 'Expand this with more detail and explanation.',
  fix: 'Fix spelling, grammar and punctuation. Change nothing else.',
  explain: 'Explain this simply, as if teaching a fellow student.',
  continue: 'Continue writing naturally from where this text stops.',
  translate: 'Translate this between English and Vietnamese (to the other language).'
}

async function taskRewrite({ text, mode = 'improve' }) {
  const rule = REWRITE_RULES[mode] || REWRITE_RULES.improve
  const system = `You are an editing assistant. ${rule} Output ONLY the resulting text, with no preamble, quotes or commentary. ${LANG_RULE}`
  const out = await callChat(turns(system, clip(text)), { temperature: 0.5, maxTokens: 2048 })
  return { text: out }
}

// ---------------------------------------------------------------------------
// Optional Supabase auth (quota protection)
// ---------------------------------------------------------------------------
async function isAuthorized(req) {
  const url = process.env.SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY
  if (!url || !anon) return true // auth not configured → endpoint is open (demo)
  const authHeader = req.headers.authorization || ''
  if (!authHeader) return false
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: authHeader }
    })
    return r.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!API_KEY) {
    return res.status(503).json({ error: 'AI not configured' })
  }
  if (!(await isAuthorized(req))) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let body = req.body
  if (typeof body === 'string') body = parseJson(body, {})
  const { task, payload = {} } = body || {}

  try {
    switch (task) {
      case 'flashcards':
        return res.status(200).json(await taskFlashcards(payload))
      case 'quiz':
        return res.status(200).json(await taskQuiz(payload))
      case 'summary':
        return res.status(200).json(await taskSummary(payload))
      case 'keywords':
        return res.status(200).json(await taskKeywords(payload))
      case 'title':
        return res.status(200).json(await taskTitle(payload))
      case 'ask':
        return res.status(200).json(await taskAsk(payload))
      case 'chat':
        return res.status(200).json(await taskChat(payload))
      case 'rewrite':
        return res.status(200).json(await taskRewrite(payload))
      default:
        return res.status(400).json({ error: `Unknown task: ${task}` })
    }
  } catch (err) {
    // Logs to the `vercel dev` terminal / Vercel function logs for diagnosis.
    console.error('[api/ai] task failed:', err?.message)
    // Surface the upstream status for client/quota errors (429 quota or rate
    // limit, 401/403 auth) so the caller can tell them apart from a real proxy
    // fault — a blanket 502 makes a depleted-quota 429 look like a broken proxy.
    const status = [400, 401, 403, 404, 429].includes(err?.status) ? err.status : 502
    return res.status(status).json({ error: err.message || 'AI request failed' })
  }
}
