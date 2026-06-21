/**
 * sourceSearch.js
 * ----------------------------------------------------------------------------
 * Extractive "Ask your sources" — honest retrieval, NOT generation (there is no
 * LLM in this project). Given a question and the user's documents, it scores
 * every sentence in the sources by keyword overlap with the question and returns
 * the top passages, each cited back to its source document.
 *
 * Reuses the existing rule-based primitives (keyword extraction + sentence
 * splitting), so it stays consistent with the rest of the "manual AI".
 */

import { tokenize, splitSentences } from './textAnalyzer.js'
import { extractKeywords } from './keywordExtractor.js'

/**
 * @param {string} question
 * @param {Array<{id:string,title:string,extracted_text?:string}>} docs
 * @param {{limit?:number}} opts
 * @returns {Array<{text:string, source:string, docId:string, score:number, matched:string[]}>}
 */
export function askSources(question, docs, { limit = 5 } = {}) {
  if (!question || !docs?.length) return []

  // Question terms: prefer extracted keywords; fall back to longer raw tokens.
  let terms = extractKeywords(question, { limit: 10 }).map((k) => k.word)
  if (!terms.length) terms = tokenize(question).filter((t) => t.length > 2)
  const qset = new Set(terms)
  if (!qset.size) return []

  const passages = []
  for (const doc of docs) {
    const sentences = splitSentences(doc.extracted_text || '')
    for (const sentence of sentences) {
      const tokens = tokenize(sentence)
      if (!tokens.length) continue
      const matched = new Set()
      let overlap = 0
      for (const tk of tokens) {
        if (qset.has(tk)) {
          overlap++
          matched.add(tk)
        }
      }
      if (overlap > 0) {
        // Reward covering more distinct question terms; normalise by length so
        // long sentences don't automatically win.
        const score = (matched.size * 2 + overlap) / Math.sqrt(tokens.length)
        passages.push({ text: sentence, source: doc.title, docId: doc.id, score, matched: [...matched] })
      }
    }
  }

  return passages.sort((a, b) => b.score - a.score).slice(0, limit)
}
