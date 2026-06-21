/**
 * sampleDecks.js
 * ----------------------------------------------------------------------------
 * Flashcard decks + the spaced-repetition stats shown on the Flashcards page.
 * Cards here are hand-authored; the app can ALSO generate cards from any note
 * via the manual flashcardGenerator util ("AI generate from note").
 */

export const flashcardStats = {
  mastered: 95,
  dueToday: 46,
  streak: 14,
  avgRecall: 87,
  reviewedLast7: [12, 18, 9, 16, 14, 22, 17], // Mon→Sun bar chart
  todayCount: 21,
  weekCount: 130,
  retention: 87
}

export const sampleDecks = [
  {
    id: 'deck-1',
    name: 'Blockchain Consensus',
    subject: 'COS30049',
    color: 'grad-blue',
    due: 3,
    total: 24,
    cards: [
      { id: 'c1', question: 'What is the purpose of slashing in PoS?', answer: 'To penalise validators who act dishonestly by destroying part of their staked collateral, aligning incentives with honest behaviour.' },
      { id: 'c2', question: 'What problem does a consensus algorithm solve?', answer: 'It lets distributed nodes agree on a single shared state even when some participants are faulty or malicious.' },
      { id: 'c3', question: 'What is a nonce in Proof-of-Work?', answer: 'A number miners repeatedly change until the block hash falls below the target difficulty.' }
    ]
  },
  {
    id: 'deck-2',
    name: 'Database Normalisation',
    subject: 'INF10025',
    color: 'grad-fuchsia',
    due: 8,
    total: 30,
    cards: [
      { id: 'c1', question: 'What is BCNF?', answer: 'A normal form where every determinant of a functional dependency is a candidate key.' },
      { id: 'c2', question: 'What is a functional dependency?', answer: 'A constraint where one set of attributes uniquely determines another.' }
    ]
  },
  {
    id: 'deck-3',
    name: 'Vue Composition API',
    subject: 'COS30043',
    color: 'grad-green',
    due: 5,
    total: 18,
    cards: [
      { id: 'c1', question: 'What is reactivity in Vue?', answer: 'The system that automatically updates the DOM when reactive state changes.' },
      { id: 'c2', question: 'What is a ref?', answer: 'A reactive container holding a single mutable value, accessed via .value.' }
    ]
  },
  {
    id: 'deck-4',
    name: 'Linear Algebra Essentials',
    subject: 'MATH2001',
    color: 'grad-orange',
    due: 6,
    total: 22,
    cards: [
      { id: 'c1', question: 'What is an eigenvalue?', answer: 'A scalar that scales its eigenvector under a linear transformation.' }
    ]
  },
  {
    id: 'deck-5',
    name: 'Intelligent Systems',
    subject: 'COS30018',
    color: 'grad-blue',
    due: 24,
    total: 40,
    cards: [
      { id: 'c1', question: 'What is a heuristic?', answer: 'A rule-of-thumb estimate used to guide search toward promising solutions.' }
    ]
  }
]
