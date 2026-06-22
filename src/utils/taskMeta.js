/**
 * taskMeta.js — shared option lists + colour classes for the task tracker.
 * Labels are i18n keys (resolved with t() in components) so the chips stay
 * bilingual. Colour classes live in styles/tasks.css.
 */
export const STATUSES = [
  { value: 'not_started', i18n: 'tasks.status.notStarted', cls: 'st-not-started' },
  { value: 'in_progress', i18n: 'tasks.status.inProgress', cls: 'st-in-progress' },
  { value: 'done', i18n: 'tasks.status.done', cls: 'st-done' }
]

export const PRIORITIES = [
  { value: 'low', i18n: 'tasks.priority.low', cls: 'pr-low' },
  { value: 'medium', i18n: 'tasks.priority.medium', cls: 'pr-medium' },
  { value: 'high', i18n: 'tasks.priority.high', cls: 'pr-high' }
]

export const TYPES = [
  { value: 'general', i18n: 'tasks.type.general', cls: 'ty-general' },
  { value: 'feature', i18n: 'tasks.type.feature', cls: 'ty-feature' },
  { value: 'bugfix', i18n: 'tasks.type.bugfix', cls: 'ty-bugfix' },
  { value: 'polish', i18n: 'tasks.type.polish', cls: 'ty-polish' },
  { value: 'research', i18n: 'tasks.type.research', cls: 'ty-research' }
]

export const statusMeta = (v) => STATUSES.find((s) => s.value === v) || STATUSES[0]
export const priorityMeta = (v) => PRIORITIES.find((p) => p.value === v) || PRIORITIES[1]
export const typeMeta = (v) => TYPES.find((t) => t.value === v) || TYPES[0]

/** AppSelect-shaped options ({ value, label }) with translated labels. */
export const toOptions = (list, t) => list.map((o) => ({ value: o.value, label: t(o.i18n) }))
