/**
 * sampleNotes.js
 * ----------------------------------------------------------------------------
 * Demo notes. The flagship note ("Consensus Mechanisms — Deep Dive") matches the
 * Collab Notes editor mockup and is written with clear definition sentences so
 * the manual flashcard/quiz generators produce rich output during a demo.
 */
export const sampleNotes = [
  {
    id: 'note-1',
    subject_id: 'sub-1',
    author_id: 'user-2',
    title: 'Consensus Mechanisms: Deep Dive',
    week: 'Week 6',
    read_minutes: 12,
    content:
      'In a decentralised network, no single authority decides which transactions are valid. ' +
      'A consensus algorithm is used for letting geographically distributed nodes agree on a single shared state despite faulty or malicious participants. ' +
      'Proof-of-Work is a consensus mechanism that requires miners to solve a computational puzzle. ' +
      'A nonce is a number that miners vary until the block hash is below the target. ' +
      'Proof-of-Stake means validators lock collateral to gain the right to propose blocks. ' +
      'Slashing refers to destroying part of a validator stake as a penalty for dishonest behaviour. ' +
      'Finality means the guarantee that a committed block will never be reverted. ' +
      'A fork occurs when two valid blocks extend the same parent at the same height.',
    visibility: 'public',
    likes_count: 64,
    version: 6,
    updated_at: '2026-06-06T09:30:00Z',
    created_at: '2026-05-20T09:00:00Z'
  },
  {
    id: 'note-2',
    subject_id: 'sub-3',
    author_id: 'user-3',
    title: 'Normalisation & BCNF',
    week: 'Week 4',
    read_minutes: 8,
    content:
      'Normalisation is the process of organising columns and tables to reduce data redundancy. ' +
      'A functional dependency means one set of attributes determines another. ' +
      'BCNF refers to a normal form where every determinant is a candidate key. ' +
      'A candidate key is a minimal set of attributes that uniquely identifies a row. ' +
      'Decomposition means splitting a relation into smaller relations without losing information.',
    visibility: 'public',
    likes_count: 41,
    version: 3,
    updated_at: '2026-06-04T14:15:00Z',
    created_at: '2026-05-18T11:00:00Z'
  },
  {
    id: 'note-3',
    subject_id: 'sub-2',
    author_id: 'user-1',
    title: 'Vue Reactivity & Composition API',
    week: 'Week 3',
    read_minutes: 10,
    content:
      'The Composition API is used for organising component logic by feature instead of by option. ' +
      'Reactivity refers to the system that automatically updates the DOM when state changes. ' +
      'A ref is a reactive container that holds a single mutable value. ' +
      'Vue Router is used for client-side navigation between pages in a single page application. ' +
      'Pinia is a state management library that allows components to share reactive global state.',
    visibility: 'public',
    likes_count: 57,
    version: 4,
    updated_at: '2026-06-05T08:45:00Z',
    created_at: '2026-05-15T13:20:00Z'
  },
  {
    id: 'note-4',
    subject_id: 'sub-4',
    author_id: 'user-4',
    title: 'Eigenvalues for Tridiagonal Matrices',
    week: 'Week 7',
    read_minutes: 9,
    content:
      'An eigenvalue is a scalar that scales an eigenvector under a linear transformation. ' +
      'A tridiagonal matrix is a matrix with non-zero entries only on the main and adjacent diagonals. ' +
      'The characteristic polynomial is used for finding eigenvalues by setting its determinant to zero. ' +
      'Diagonalisation means expressing a matrix as a product involving its eigenvalues.',
    visibility: 'public',
    likes_count: 33,
    version: 2,
    updated_at: '2026-06-03T16:10:00Z',
    created_at: '2026-05-22T10:00:00Z'
  }
]
