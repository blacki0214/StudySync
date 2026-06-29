/**
 * quizGenerator.js
 * ----------------------------------------------------------------------------
 * Manual multiple-choice quiz generation (no AI API).
 *
 * Pipeline:
 *   1. Generate flashcards (question + correct answer) from the note.
 *   2. Build a pool of DISTRACTORS from the answers of OTHER flashcards plus
 *      extracted keywords.
 *   3. For each question, pick 3 plausible distractors, add the correct answer,
 *      then shuffle the four options with a manual Fisher-Yates shuffle.
 *   4. Record the index of the correct answer after shuffling.
 */

import { generateFlashcards } from './flashcardGenerator.js'
import { extractKeywords } from './keywordExtractor.js'

/**
 * Manual Fisher-Yates shuffle. We implement it by hand (rather than relying on
 * Array.sort with a random comparator) because Fisher-Yates is provably uniform
 * and demonstrates the "shuffle options manually" requirement explicitly.
 *
 * @template T
 * @param {T[]} array
 * @returns {T[]} a new shuffled array (input is not mutated)
 */
export function shuffle(array) {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Shorten a long answer into a compact option label. Multiple-choice options
 * read better when they are a few words rather than a full clause.
 * @param {string} text
 */
function toOption(text) {
  const words = text.split(/\s+/)
  if (words.length <= 6) return text
  return words.slice(0, 6).join(' ') + '…'
}

/**
 * Build a quiz from note content.
 *
 * @param {string} content
 * @param {object} [options]
 * @param {number} [options.maxQuestions=8]
 * @param {number} [options.optionsPerQuestion=4]
 * @returns {Array<{question:string, options:string[], correctAnswer:number}>}
 *          `correctAnswer` is the INDEX into `options`.
 */
export function generateQuiz(content, options = {}) {
  const { maxQuestions = 8, optionsPerQuestion = 4 } = options
  const flashcards = generateFlashcards(content, { maxCards: maxQuestions })
  if (flashcards.length < 2) return [] // need at least 2 cards to cross-source distractors

  // Distractor pool: short forms of every flashcard answer + top keywords.
  const answerPool = flashcards.map((c) => toOption(c.answer))
  const keywordPool = extractKeywords(content, { limit: 12 }).map((k) => k.word)
  const distractorPool = [...new Set([...answerPool, ...keywordPool])]

  const quiz = []

  for (const card of flashcards) {
    const correct = toOption(card.answer)

    // Pick distractors that are not equal to the correct answer.
    const candidates = shuffle(distractorPool.filter((d) => d !== correct))
    const distractors = candidates.slice(0, optionsPerQuestion - 1)

    // If the note was too small to supply enough unique distractors, skip the
    // question rather than show a half-empty option list.
    if (distractors.length < optionsPerQuestion - 1) continue

    const allOptions = shuffle([correct, ...distractors])
    const correctAnswer = allOptions.indexOf(correct)

    quiz.push({
      question: card.question,
      options: allOptions,
      correctAnswer
    })
  }

  return quiz
}
