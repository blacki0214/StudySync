/**
 * Sample notes used in DEMO MODE. The content is written with clear definition
 * sentences ("X is ...", "X refers to ...") so the manual flashcard and quiz
 * generators have rich material to parse during a demo.
 */
export const sampleNotes = [
  {
    id: 'note-1',
    subject_id: 'sub-1',
    author_id: 'user-1',
    title: 'Vue 3 Core Concepts',
    content:
      'Vue is a progressive JavaScript framework for building user interfaces. ' +
      'The Composition API is used for organising component logic by feature instead of by option. ' +
      'Reactivity refers to the system that automatically updates the DOM when state changes. ' +
      'Vue Router is used for client-side navigation between pages in a single page application. ' +
      'Pinia is a state management library that allows components to share reactive global state. ' +
      'A component is a reusable, self-contained block of markup, logic and style.',
    visibility: 'public',
    likes_count: 24,
    version: 3,
    updated_at: '2026-06-01T10:30:00Z',
    created_at: '2026-05-20T09:00:00Z'
  },
  {
    id: 'note-2',
    subject_id: 'sub-2',
    author_id: 'user-2',
    title: 'Hash Tables and Complexity',
    content:
      'A hash table is a data structure that maps keys to values using a hash function. ' +
      'A hash function is used for converting a key into an array index. ' +
      'A collision occurs when two keys hash to the same index. ' +
      'Chaining refers to storing colliding elements in a linked list at each bucket. ' +
      'Big O notation describes the worst-case growth rate of an algorithm as input size increases. ' +
      'Amortised analysis means averaging the cost of operations over a sequence of operations.',
    visibility: 'public',
    likes_count: 18,
    version: 2,
    updated_at: '2026-05-30T14:15:00Z',
    created_at: '2026-05-18T11:00:00Z'
  },
  {
    id: 'note-3',
    subject_id: 'sub-3',
    author_id: 'user-1',
    title: 'OOP Pillars',
    content:
      'Encapsulation is the bundling of data and the methods that operate on that data. ' +
      'Inheritance allows a class to acquire properties and behaviour from a parent class. ' +
      'Polymorphism means that a single interface can represent different underlying types. ' +
      'Abstraction refers to hiding complex implementation detail behind a simple interface. ' +
      'An interface is a contract that defines the methods a class must implement.',
    visibility: 'public',
    likes_count: 31,
    version: 5,
    updated_at: '2026-06-05T08:45:00Z',
    created_at: '2026-05-15T13:20:00Z'
  }
]
