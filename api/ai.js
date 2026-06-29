/**
 * api/ai.js — Vercel Serverless Function (the Gemini proxy).
 * ----------------------------------------------------------------------------
 * The browser must NEVER see the Gemini key (anything in the Vite bundle is
 * public), so all model calls go through this server-side endpoint. The key
 * lives in the Vercel env var GEMINI_API_KEY and never leaves the server.
 *
 *   Browser (src/services/aiService.js)  ──POST {task, payload}──►  this fn  ──►  Gemini
 *
 * Tasks: flashcards | quiz | summary | keywords | ask | chat | rewrite.
 * Structured tasks use Gemini's JSON mode (responseSchema) so the frontend
 * receives typed objects that match the existing manual-util shapes exactly.
 *
 * Optional auth: if SUPABASE_URL + SUPABASE_ANON_KEY are set in the Vercel env,
 * the caller's Supabase access token is verified, so only logged-in users can
 * spend your Gemini quota. If they aren't set, the endpoint stays open (demo).
 *
 * Local dev: plain `vite` does NOT run this file. Use `vercel dev` to exercise
 * the AI features locally; otherwise aiService falls back to the manual utils.
 */

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

// Keep prompts (and cost) bounded — notes can be huge.
const MAX_INPUT_CHARS = 12000
const clip = (s) => String(s || '').slice(0, MAX_INPUT_CHARS)

// ---------------------------------------------------------------------------
// Gemini call
// ---------------------------------------------------------------------------
async function callGemini(contents, { system, schema, temperature = 0.4 } = {}) {
  const key = process.env.GEMINI_API_KEY
  const body = { contents, generationConfig: { temperature } }
  if (system) body.systemInstruction = { parts: [{ text: system }] }
  if (schema) {
    body.generationConfig.responseMimeType = 'application/json'
    body.generationConfig.responseSchema = schema
  }

  const resp = await fetch(`${ENDPOINT(MODEL)}?key=${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    throw new Error(`Gemini ${resp.status}: ${detail.slice(0, 300)}`)
  }
  const data = await resp.json()
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim()
  return text
}

// Wrap a plain user string as a Gemini `contents` array.
const userTurn = (text) => [{ role: 'user', parts: [{ text }] }]

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
// JSON schemas (uppercase types per Gemini's OpenAPI subset)
// ---------------------------------------------------------------------------
const flashcardsSchema = {
  type: 'OBJECT',
  properties: {
    flashcards: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { question: { type: 'STRING' }, answer: { type: 'STRING' } },
        required: ['question', 'answer']
      }
    }
  },
  required: ['flashcards']
}

const quizSchema = {
  type: 'OBJECT',
  properties: {
    quiz: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' } },
          correctAnswer: { type: 'INTEGER' }, // 0-based index into options
          explanation: { type: 'STRING' } // why the correct option is right
        },
        required: ['question', 'options', 'correctAnswer', 'explanation']
      }
    }
  },
  required: ['quiz']
}

const summarySchema = {
  type: 'OBJECT',
  properties: { summary: { type: 'ARRAY', items: { type: 'STRING' } } },
  required: ['summary']
}

const keywordsSchema = {
  type: 'OBJECT',
  properties: {
    keywords: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { word: { type: 'STRING' }, technical: { type: 'BOOLEAN' } },
        required: ['word']
      }
    }
  },
  required: ['keywords']
}

const titleSchema = {
  type: 'OBJECT',
  properties: { title: { type: 'STRING' } },
  required: ['title']
}

const askSchema = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING' },
    citations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { source: { type: 'STRING' }, quote: { type: 'STRING' } },
        required: ['source']
      }
    }
  },
  required: ['answer']
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
const LANG_RULE =
  'Always answer in the SAME language as the study material (English or Vietnamese). Do not invent facts that are not supported by the material.'

async function taskFlashcards({ text, max = 12 }) {
  const system = `You are a study assistant that writes high-quality flashcards from a student's notes. Each card tests ONE fact: a clear, specific question and a concise answer (a phrase or single sentence). Avoid yes/no questions and duplicates. ${LANG_RULE}`
  const out = await callGemini(
    userTurn(`Create up to ${max} flashcards from these notes:\n\n${clip(text)}`),
    { system, schema: flashcardsSchema, temperature: 0.3 }
  )
  const parsed = parseJson(out, { flashcards: [] })
  return { flashcards: (parsed.flashcards || []).slice(0, max) }
}

async function taskQuiz({ text, max = 8 }) {
  const system = `You are a study assistant that writes multiple-choice quiz questions from a student's notes. Each question has EXACTLY 4 options, exactly one correct. Distractors must be plausible and drawn from the same topic. "correctAnswer" is the 0-based index of the correct option. "explanation" is one or two sentences saying why the correct option is right (and, if helpful, why a tempting wrong one is not). ${LANG_RULE}`
  const out = await callGemini(
    userTurn(`Write up to ${max} multiple-choice questions from these notes:\n\n${clip(text)}`),
    { system, schema: quizSchema, temperature: 0.4 }
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
  const system = `You summarise study notes into the ${max} most important points. Each point is one short, self-contained sentence a student can revise from. ${LANG_RULE}`
  const out = await callGemini(
    userTurn(`Summarise these notes into up to ${max} key points:\n\n${clip(text)}`),
    { system, schema: summarySchema, temperature: 0.3 }
  )
  const parsed = parseJson(out, { summary: [] })
  return { summary: (parsed.summary || []).slice(0, max) }
}

async function taskKeywords({ text, limit = 12 }) {
  const system = `You extract the most important keywords/terms from study notes. Return single words or short phrases. Mark "technical": true for domain/academic terms, false for everyday words. ${LANG_RULE}`
  const out = await callGemini(
    userTurn(`Extract up to ${limit} key terms from these notes:\n\n${clip(text)}`),
    { system, schema: keywordsSchema, temperature: 0.2 }
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
  const system = `You write a short, specific title for a study note based on its content. 3-8 words, descriptive, no surrounding quotes, no trailing punctuation. ${LANG_RULE}`
  const out = await callGemini(
    userTurn(`Write a title for this note:\n\n${clip(text)}`),
    { system, schema: titleSchema, temperature: 0.4 }
  )
  const parsed = parseJson(out, { title: '' })
  return { title: String(parsed.title || '').replace(/^["'\s]+|["'\s.]+$/g, '') }
}

async function taskAsk({ question, passages = [] }) {
  const system = `You answer a student's question USING ONLY the provided source passages. Cite the sources you used. If the passages do not contain the answer, say so plainly instead of guessing. ${LANG_RULE}`
  const sources = passages
    .map((p, i) => `[${i + 1}] (${p.source || 'source'}) ${clip(p.text)}`)
    .join('\n\n')
  const out = await callGemini(
    userTurn(`Question: ${question}\n\nSource passages:\n${sources}`),
    { system, schema: askSchema, temperature: 0.2 }
  )
  return parseJson(out, { answer: '', citations: [] })
}

async function taskChat({ messages = [], context = '' }) {
  const system =
    `You are StudySync's study tutor: friendly, accurate and concise. Explain clearly, use examples, and prefer short paragraphs or bullet points. ${LANG_RULE}` +
    (context ? `\n\nThe student is working on this note:\n${clip(context)}` : '')
  const contents = messages
    .filter((m) => m && m.content)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content) }]
    }))
  const text = await callGemini(contents, { system, temperature: 0.6 })
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
  const out = await callGemini(userTurn(clip(text)), { system, temperature: 0.5 })
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
  if (!process.env.GEMINI_API_KEY) {
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
    return res.status(502).json({ error: err.message || 'AI request failed' })
  }
}
