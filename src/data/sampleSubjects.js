/**
 * sampleSubjects.js
 * ----------------------------------------------------------------------------
 * Subjects shown in the Subjects page and dashboard, matching the Figma. Each
 * carries a coloured letter badge (`letters` + `color` gradient key), rating,
 * note/student counts and a per-user progress value for the dashboard.
 */
export const sampleSubjects = [
  {
    id: 'sub-1',
    code: 'COS30049',
    letters: 'COS',
    color: 'grad-blue',
    name: 'Blockchain Tech',
    description: 'Distributed ledgers, consensus mechanisms and smart-contract security.',
    category: 'Computing',
    rating: 4.8,
    notes_count: 89,
    students: 1280,
    progress: 78,
    created_at: '2026-02-10T08:00:00Z'
  },
  {
    id: 'sub-2',
    code: 'COS30043',
    letters: 'COS',
    color: 'grad-green',
    name: 'Interactive Web Apps',
    description: 'Modern front-end engineering with Vue 3, accessibility and responsive design.',
    category: 'Computing',
    rating: 4.9,
    notes_count: 142,
    students: 1840,
    progress: 64,
    created_at: '2026-02-10T08:00:00Z'
  },
  {
    id: 'sub-3',
    code: 'INF10025',
    letters: 'INF',
    color: 'grad-fuchsia',
    name: 'Database Design',
    description: 'Relational modelling, normalisation, indexing and query optimisation.',
    category: 'Computing',
    rating: 4.7,
    notes_count: 178,
    students: 2100,
    progress: 64,
    created_at: '2026-02-10T08:00:00Z'
  },
  {
    id: 'sub-4',
    code: 'MATH2001',
    letters: 'MAT',
    color: 'grad-orange',
    name: 'Linear Algebra',
    description: 'Vector spaces, eigenvalues, decompositions and applications.',
    category: 'Mathematics',
    rating: 4.6,
    notes_count: 64,
    students: 980,
    progress: 41,
    created_at: '2026-02-10T08:00:00Z'
  },
  {
    id: 'sub-5',
    code: 'COS30018',
    letters: 'COS',
    color: 'grad-blue',
    name: 'Intelligent Systems',
    description: 'Search, machine-learning foundations and intelligent agents.',
    category: 'Computing',
    rating: 4.5,
    notes_count: 73,
    students: 1120,
    progress: 30,
    created_at: '2026-02-10T08:00:00Z'
  },
  {
    id: 'sub-6',
    code: 'BUS20001',
    letters: 'BUS',
    color: 'grad-green',
    name: 'Digital Marketing',
    description: 'Growth, analytics and modern D2C marketing channels.',
    category: 'Business',
    rating: 4.4,
    notes_count: 51,
    students: 860,
    progress: 0,
    created_at: '2026-02-10T08:00:00Z'
  }
]

export const subjectById = (id) => sampleSubjects.find((s) => s.id === id) || null

// Decks and community posts reference a subject by CODE (e.g. "COS30049"),
// while notes and rooms use the subject id — this bridges the two.
export const subjectByCode = (code) => sampleSubjects.find((s) => s.code === code) || null
