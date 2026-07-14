/**
 * taskStatusTemplates.js — the customizable-status system (ClickUp-style).
 * ----------------------------------------------------------------------------
 * A STATUS is `{ id, name, color, group }` where group is one of the four
 * lifecycle buckets below. Boards can use a built-in template, a user-saved
 * template, or a fully custom set. The `basic` template intentionally keeps the
 * ids not_started/in_progress/done so tasks created before this feature keep
 * working unchanged.
 */

/** The four fixed lifecycle groups every status belongs to (order matters). */
export const STATUS_GROUPS = [
  { key: 'notstarted', i18n: 'tasks.group.notStarted' },
  { key: 'active', i18n: 'tasks.group.active' },
  { key: 'done', i18n: 'tasks.group.done' },
  { key: 'closed', i18n: 'tasks.group.closed' }
]
export const GROUP_KEYS = STATUS_GROUPS.map((g) => g.key)

/** Palette offered in the colour picker. */
export const STATUS_COLORS = [
  '#8b95a5', '#6366f1', '#3b82f6', '#06b6d4', '#10b981',
  '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7'
]

/** Built-in status templates for different kinds of work. */
export const BUILTIN_TEMPLATES = [
  {
    key: 'basic', name: 'Basic',
    statuses: [
      { id: 'not_started', name: 'To do', color: '#8b95a5', group: 'notstarted' },
      { id: 'in_progress', name: 'In progress', color: '#f59e0b', group: 'active' },
      { id: 'done', name: 'Done', color: '#22c55e', group: 'done' }
    ]
  },
  {
    key: 'kanban', name: 'Kanban',
    statuses: [
      { id: 'backlog', name: 'Backlog', color: '#8b95a5', group: 'notstarted' },
      { id: 'not_started', name: 'To do', color: '#6366f1', group: 'active' },
      { id: 'in_progress', name: 'In progress', color: '#f59e0b', group: 'active' },
      { id: 'review', name: 'Review', color: '#06b6d4', group: 'active' },
      { id: 'done', name: 'Done', color: '#22c55e', group: 'done' }
    ]
  },
  {
    key: 'software', name: 'Software team',
    statuses: [
      { id: 'backlog', name: 'Backlog', color: '#8b95a5', group: 'notstarted' },
      { id: 'not_started', name: 'To do', color: '#6366f1', group: 'active' },
      { id: 'in_progress', name: 'In progress', color: '#f59e0b', group: 'active' },
      { id: 'testing', name: 'Testing', color: '#a855f7', group: 'active' },
      { id: 'review', name: 'Review', color: '#06b6d4', group: 'active' },
      { id: 'done', name: 'Completed', color: '#22c55e', group: 'done' },
      { id: 'cancelled', name: 'Cancelled', color: '#ef4444', group: 'closed' }
    ]
  },
  {
    key: 'study', name: 'Study plan',
    statuses: [
      { id: 'not_started', name: 'To study', color: '#8b95a5', group: 'notstarted' },
      { id: 'in_progress', name: 'Studying', color: '#3b82f6', group: 'active' },
      { id: 'revising', name: 'Revising', color: '#f59e0b', group: 'active' },
      { id: 'done', name: 'Mastered', color: '#22c55e', group: 'done' }
    ]
  },
  {
    key: 'content', name: 'Content',
    statuses: [
      { id: 'not_started', name: 'Idea', color: '#8b95a5', group: 'notstarted' },
      { id: 'in_progress', name: 'Drafting', color: '#f59e0b', group: 'active' },
      { id: 'review', name: 'Editing', color: '#06b6d4', group: 'active' },
      { id: 'done', name: 'Published', color: '#22c55e', group: 'done' },
      { id: 'archived', name: 'Archived', color: '#8b95a5', group: 'closed' }
    ]
  }
]

/** The default set a brand-new board starts with. */
export const DEFAULT_STATUSES = () => clone(BUILTIN_TEMPLATES[0].statuses)

/** Status ids that count as "finished" (done or closed) across every built-in
 *  template — a good-enough heuristic where the live set isn't loaded (schedule). */
export const DONE_STATUS_IDS = new Set(
  BUILTIN_TEMPLATES.flatMap((tpl) => tpl.statuses)
    .filter((s) => s.group === 'done' || s.group === 'closed')
    .map((s) => s.id)
)

/** Deep-clone a status list so callers can edit without mutating the constant. */
export function clone(statuses) {
  return (statuses || []).map((s) => ({ ...s }))
}

/** True when a status (by group, or by id fallback) means the task is finished. */
export function isDoneStatus(statusId, statuses = null) {
  if (statuses) {
    const s = statuses.find((x) => x.id === statusId)
    return s ? (s.group === 'done' || s.group === 'closed') : false
  }
  return DONE_STATUS_IDS.has(statusId)
}

/** A URL-safe id from a status name, made unique against existing ids. */
export function statusIdFrom(name, existingIds = []) {
  const base = (name || 'status').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'status'
  let id = base
  let n = 2
  const taken = new Set(existingIds)
  while (taken.has(id)) id = `${base}_${n++}`
  return id
}
