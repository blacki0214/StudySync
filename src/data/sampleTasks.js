/**
 * sampleTasks.js
 * ----------------------------------------------------------------------------
 * Demo-mode seed for the task tracker. Personal tasks have subject_id = null;
 * subject tasks reference a sample subject id (see sampleSubjects.js). Dates are
 * around the demo "today" so due-date / overdue styling is visible.
 */
export const sampleTasks = [
  // ---- Personal tasks (My Tasks page) ----
  {
    id: 'task-1', owner_id: 'demo-user', subject_id: null,
    title: 'Revise lecture 7: consensus algorithms', status: 'in_progress',
    priority: 'high', type: 'research', due_date: '2026-06-24',
    description: 'Summarise PoW vs PoS and make flashcards.', position: 0,
    assignee_name: 'You', created_at: '2026-06-20T08:00:00Z'
  },
  {
    id: 'task-2', owner_id: 'demo-user', subject_id: null,
    title: 'Finish Vue assignment write-up', status: 'not_started',
    priority: 'medium', type: 'general', due_date: '2026-06-28',
    description: 'Document the component structure and accessibility choices.', position: 1,
    assignee_name: 'You', created_at: '2026-06-20T09:00:00Z'
  },
  {
    id: 'task-3', owner_id: 'demo-user', subject_id: null,
    title: 'Read chapter 4 before tutorial', status: 'done',
    priority: 'low', type: 'general', due_date: '2026-06-18',
    description: '', position: 2,
    assignee_name: 'You', created_at: '2026-06-15T09:00:00Z'
  },

  // ---- Subject tasks (sub-1: Blockchain Tech) ----
  {
    id: 'task-4', owner_id: 'demo-user', subject_id: 'sub-1',
    title: 'Group: build smart-contract demo', status: 'in_progress',
    priority: 'high', type: 'feature', due_date: '2026-06-30',
    description: 'Deploy a sample token contract to a testnet.', position: 0,
    assignee_name: 'Quoc Nguyen', created_at: '2026-06-19T09:00:00Z'
  },
  {
    id: 'task-5', owner_id: 'demo-user', subject_id: 'sub-1',
    title: 'Fix references in the report', status: 'not_started',
    priority: 'medium', type: 'bugfix', due_date: '2026-07-02',
    description: 'Convert all citations to IEEE style.', position: 1,
    assignee_name: 'You', created_at: '2026-06-19T10:00:00Z'
  },

  // ---- Subject tasks (sub-2: Interactive Web Apps) ----
  {
    id: 'task-6', owner_id: 'demo-user', subject_id: 'sub-2',
    title: 'Polish the dashboard responsiveness', status: 'not_started',
    priority: 'low', type: 'polish', due_date: '2026-07-05',
    description: 'Check breakpoints on tablet sizes.', position: 0,
    assignee_name: 'You', created_at: '2026-06-19T11:00:00Z'
  }
]
