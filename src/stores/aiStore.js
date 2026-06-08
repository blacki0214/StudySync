/**
 * aiStore.js
 * ----------------------------------------------------------------------------
 * Orchestrates the MANUAL "AI" utilities (no external API). It simply runs the
 * rule-based generators in src/utils and caches their results so multiple
 * components (FlashcardsView, KeywordExtractor, DifficultyHeatmap...) can share
 * a single computation per note.
 */

import { defineStore } from 'pinia'
import { generateFlashcards } from '../utils/flashcardGenerator.js'
import { generateQuiz } from '../utils/quizGenerator.js'
import { extractKeywords } from '../utils/keywordExtractor.js'
import { analyzeDifficulty } from '../utils/difficultyAnalyzer.js'
import { extractKeySentences } from '../utils/textAnalyzer.js'

export const useAiStore = defineStore('ai', {
  state: () => ({
    flashcards: [],
    quiz: [],
    keywords: [],
    difficulty: null,
    summary: []
  }),

  actions: {
    /**
     * Run every analysis for a piece of note content in one pass. Each piece is
     * independent rule-based JS, so this is fast and fully offline.
     */
    analyze(content) {
      this.keywords = extractKeywords(content, { limit: 12 })
      this.flashcards = generateFlashcards(content, { maxCards: 12 })
      this.quiz = generateQuiz(content, { maxQuestions: 8 })
      this.difficulty = analyzeDifficulty(content)
      this.summary = extractKeySentences(content, this.keywords, 4)
    },

    generateFlashcardsOnly(content) {
      this.flashcards = generateFlashcards(content, { maxCards: 12 })
      return this.flashcards
    },

    generateQuizOnly(content) {
      this.quiz = generateQuiz(content, { maxQuestions: 8 })
      return this.quiz
    },

    clear() {
      this.flashcards = []
      this.quiz = []
      this.keywords = []
      this.difficulty = null
      this.summary = []
    }
  }
})
