/**
 * ml-ai/questionGen.js — OPTIONAL local ML question generator (transformers.js).
 * ----------------------------------------------------------------------------
 * Runs a fine-tuned T5-small model FULLY IN THE BROWSER (WebAssembly) via
 * @xenova/transformers — no API, no rate limit. Trained with
 * notebooks/question-gen.ipynb and exported to ONNX.
 *
 * It picks salient terms (the rule-based keyword extractor) as the "answers",
 * then has the model phrase a natural question for each → flashcards.
 *
 * Wired in as the OFFLINE flashcard fallback: aiService.generateFlashcards tries
 * Gemini first, then this local model. It is imported dynamically, so the heavy
 * transformers.js dependency stays out of the main bundle until first use.
 *
 * Model source: by default the self-hosted, int8-quantized copy under
 * public/models/t5-small-qg-v1 (served at /models/, ~80 MB, cached by the
 * browser after first load). The folder is VERSIONED (…-v1): bump the suffix
 * whenever the model files change so browsers fetch fresh URLs instead of a
 * stale cached copy. Set VITE_QG_MODEL_ID to a Hugging Face repo id and
 * VITE_QG_MODEL_REMOTE=true to load from the HF CDN instead.
 */

const MODEL_ID = import.meta.env.VITE_QG_MODEL_ID || 't5-small-qg-v1'
const USE_REMOTE = import.meta.env.VITE_QG_MODEL_REMOTE === 'true'
const HL = '<hl>'

let _pipe = null

/** Lazily load the model the first time it's needed (downloads once, then cached). */
async function getPipeline() {
  if (_pipe) return _pipe
  const { pipeline, env } = await import('@xenova/transformers')
  if (!USE_REMOTE) {
    // Self-host: fetch the model from the app's own /models/ folder, no network.
    env.allowRemoteModels = false
    env.localModelPath = '/models/'
  }
  _pipe = await pipeline('text2text-generation', MODEL_ID, { quantized: true })
  return _pipe
}

/**
 * Convert note HTML (from the rich-text editor) into clean, well-spaced plain
 * text. Without this, tags like <p> leak into the prompt and block boundaries
 * collapse words together ("target value" -> "targetvalue"), which wrecks the
 * model's output. Block-level tags become sentence breaks so splitSentences can
 * still segment. Safe on plain text (no tags -> effectively a no-op).
 */
function htmlToText(html) {
  let s = String(html || '')
  if (!s.includes('<')) return s // already plain text
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<li[^>]*>/gi, '\n') // list items start on a new line
  s = s.replace(/<\/(p|div|li|h[1-6]|blockquote|tr|section|article)>/gi, '.\n') // block end -> sentence break
  s = s.replace(/<[^>]+>/g, ' ') // strip any remaining tags
  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
  return s
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\.\s*\.(\s|$)/g, '.$1') // collapse doubled periods from block breaks
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/** Wrap `answer` in <hl> markers inside `sentence` (case-insensitive match). */
function highlight(sentence, answer) {
  const i = sentence.toLowerCase().indexOf(answer.toLowerCase())
  if (i === -1) return `generate question: ${sentence}`
  const exact = sentence.slice(i, i + answer.length)
  return `generate question: ${sentence.slice(0, i)} ${HL} ${exact} ${HL} ${sentence.slice(i + answer.length)}`
}

/**
 * Reject weak generations so only meaningful cards reach the user. T5-small
 * sometimes emits stubs ("What?"), drops the '?', echoes the answer, or leaves a
 * run-on token — better to skip those than show a bad card.
 */
function isGoodQuestion(q, answer) {
  if (!q || !q.endsWith('?')) return false
  const words = q.split(/\s+/)
  if (words.length < 4) return false // "What?", "What is?"
  if (words.some((w) => w.length > 28)) return false // leftover merged run-on
  const lc = q.toLowerCase()
  if (lc === `what is ${answer.toLowerCase()}?`) return false // trivial echo of the answer
  if (/^(what|who|where|when|which)\??$/i.test(q.replace(/\s+/g, ''))) return false
  return true
}

/**
 * Generate flashcards locally: key terms (rule-based) become the answers, the
 * model phrases the questions. Same shape as aiService.generateFlashcards.
 * @returns {Promise<Array<{question:string, answer:string, pattern:string}>>}
 */
export async function generateFlashcardsML(content, { max = 12 } = {}) {
  const { splitSentences } = await import('../utils/textAnalyzer.js')
  const { extractKeywords } = await import('../manual-ai/keywordExtractor.js')
  const pipe = await getPipeline()

  const sentences = splitSentences(htmlToText(content))
  const cards = []
  const seenQ = new Set()
  const seenA = new Set()

  for (const sentence of sentences) {
    if (cards.length >= max) break
    const wc = sentence.split(/\s+/).length
    if (wc < 6 || wc > 45) continue // skip fragments and unwieldy run-ons

    // Prefer a technical term as the answer; fall back to the top keyword.
    const kws = extractKeywords(sentence, { limit: 4 })
    const kw = kws.find((k) => k.technical) || kws[0]
    if (!kw) continue
    const answer = kw.word
    if (seenA.has(answer.toLowerCase())) continue // one card per answer term

    const out = await pipe(highlight(sentence, answer), { max_new_tokens: 48, num_beams: 4 })
    const question = (out?.[0]?.generated_text || '').trim()
    const key = question.toLowerCase()
    if (!isGoodQuestion(question, answer) || seenQ.has(key)) continue

    seenQ.add(key)
    seenA.add(answer.toLowerCase())
    cards.push({ question, answer, pattern: 'ml' })
  }
  return cards
}

export default { generateFlashcardsML }
