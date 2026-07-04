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
  if (q.toLowerCase() === `what is ${answer.toLowerCase()}?`) return false // trivial echo
  return true
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Parse a definition sentence ("Term is/means/refers to explanation") into its
 * concept term and explanation. These make the strongest flashcards: the
 * explanation becomes the answer and the question asks about the term.
 */
function extractDefinition(sentence) {
  const m = sentence.match(
    /^(.{2,60}?)\s+(?:is defined as|refers to|is known as|is called|means|denotes|describes|is an|is a|are|is)\s+(.{6,}?)[.!?]?$/i
  )
  if (!m) return null
  const term = m[1].trim().replace(/^(?:the|a|an)\s+/i, '')
  const definition = m[2].trim()
  const termWords = term.split(/\s+/)
  if (termWords.length < 1 || termWords.length > 6) return null
  if (/^(?:it|this|that|they|these|those|there|here|he|she|we|you|i)$/i.test(term)) return null
  if (definition.split(/\s+/).length < 2) return null
  return { term, definition }
}

/** Trim a long explanation to a tidy answer (<= ~22 words, no dangling clause). */
function tidyAnswer(text, maxWords = 22) {
  const words = text.split(/\s+/)
  const out = words.length > maxWords ? words.slice(0, maxWords).join(' ') + '…' : words.join(' ')
  return out.replace(/[,;:]\s*(…?)$/, '$1').trim()
}

/**
 * Generate flashcards locally. Prefer concept cards from definition sentences
 * (term → explanation); for other sentences, highlight a salient term and let
 * the model phrase a question about it. Same shape as aiService.generateFlashcards.
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

  const add = (question, answer) => {
    const qk = question.toLowerCase()
    const ak = answer.toLowerCase()
    if (seenQ.has(qk) || seenA.has(ak)) return false
    seenQ.add(qk)
    seenA.add(ak)
    cards.push({ question, answer, pattern: 'ml' })
    return true
  }

  for (const sentence of sentences) {
    if (cards.length >= max) break
    const wc = sentence.split(/\s+/).length
    if (wc < 5 || wc > 45) continue // skip fragments and unwieldy run-ons

    // 1) Concept card from a definition — the highest-value shape. Let the model
    //    phrase the question (answer = the explanation); if it comes out weak or
    //    off-topic, fall back to a clean "What is <term>?" template.
    const def = extractDefinition(sentence)
    if (def && !seenA.has(def.term.toLowerCase())) {
      const out = await pipe(highlight(sentence, def.definition), { max_new_tokens: 48, num_beams: 4 })
      const g = (out?.[0]?.generated_text || '').trim()
      const onTopic = new RegExp(escapeRe(def.term.split(/\s+/)[0]), 'i').test(g)
      const question = isGoodQuestion(g, def.definition) && onTopic ? g : `What is ${def.term}?`
      if (add(question, tidyAnswer(def.definition))) continue
    }

    // 2) Otherwise: highlight a salient (preferably technical) term and let the
    //    model ask about it.
    const kws = extractKeywords(sentence, { limit: 5 })
    const kw = kws.find((k) => k.technical && k.word.length > 3) || kws[0]
    if (!kw) continue
    const answer = kw.word
    if (seenA.has(answer.toLowerCase())) continue

    const out = await pipe(highlight(sentence, answer), { max_new_tokens: 48, num_beams: 4 })
    const question = (out?.[0]?.generated_text || '').trim()
    if (isGoodQuestion(question, answer)) add(question, answer)
  }
  return cards
}

export default { generateFlashcardsML }
