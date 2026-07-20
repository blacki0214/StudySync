/**
 * taskImport.js
 * ----------------------------------------------------------------------------
 * Parse pasted/uploaded text into a list of task patches the task tracker can
 * bulk-create. Two input shapes are auto-detected:
 *
 *   • JSON  — an array of objects, or { "tasks": [ … ] }. Each object may use
 *             either camelCase or snake_case keys (title, status, priority,
 *             type, dueDate/due_date, description).
 *   • TEXT  — one task per line (Markdown-friendly). Leading list markers
 *             (-, *, 1.) and checkboxes ([ ] / [x]) are stripped; a ticked box
 *             marks the task done. Inline tokens are pulled out of the title:
 *               !low !medium !high !urgent   → priority
 *               #feature #bugfix #polish …   → type (must be a known type)
 *               @2026-08-01                  → due date (YYYY-MM-DD)
 *             Everything left over becomes the title. Blank lines and Markdown
 *             headings (`# …`) are ignored.
 *
 * Status/priority/type values are validated against what the current board
 * actually supports (custom statuses included) and normalised; unknown values
 * fall back to a sensible default and raise a non-fatal warning.
 */

import { PRIORITIES, TYPES } from './taskMeta.js'
import { isDoneStatus } from './taskStatusTemplates.js'

const PRIORITY_IDS = PRIORITIES.map((p) => p.value)
const TYPE_IDS = TYPES.map((t) => t.value)

// Common words people type that should map onto our fixed vocab.
const PRIORITY_ALIASES = { l: 'low', lo: 'low', m: 'medium', med: 'medium', normal: 'medium', h: 'high', hi: 'high', urgent: 'high', critical: 'high' }
const TYPE_ALIASES = { bug: 'bugfix', fix: 'bugfix', feat: 'feature', chore: 'general', task: 'general', doc: 'research', docs: 'research' }

const norm = (v) => String(v ?? '').trim().toLowerCase()

/** Map a free-text priority onto low|medium|high (default medium). */
export function resolvePriority(value) {
  const v = norm(value)
  if (PRIORITY_IDS.includes(v)) return v
  return PRIORITY_ALIASES[v] || 'medium'
}

/** Map a free-text type onto our known types (default general). */
export function resolveType(value) {
  const v = norm(value)
  if (TYPE_IDS.includes(v)) return v
  return TYPE_ALIASES[v] || 'general'
}

/**
 * Resolve a free-text status against the board's live statuses.
 * Matches by id, then by name (case-insensitive), then a few common words.
 * @param {string} value
 * @param {Array<{id,name,group}>} statuses
 * @param {string} fallbackId  status id to use when nothing matches
 * @param {boolean} [doneHint] when true (e.g. a ticked checkbox) and value is
 *   empty, resolve to the board's first "done" status.
 */
export function resolveStatus(value, statuses, fallbackId, doneHint = false) {
  const list = statuses || []
  const v = norm(value)
  if (!v) {
    if (doneHint) return (list.find((s) => s.group === 'done') || list.find((s) => isDoneStatus(s.id, list)))?.id || fallbackId
    return fallbackId
  }
  const byId = list.find((s) => norm(s.id) === v)
  if (byId) return byId.id
  const byName = list.find((s) => norm(s.name) === v)
  if (byName) return byName.id
  // Word heuristics onto lifecycle groups.
  if (['done', 'complete', 'completed', 'finished', 'x'].includes(v)) return (list.find((s) => s.group === 'done') || {}).id || fallbackId
  if (['doing', 'wip', 'in progress', 'in_progress', 'active', 'started'].includes(v)) return (list.find((s) => s.group === 'active') || {}).id || fallbackId
  if (['todo', 'to do', 'backlog', 'not started', 'not_started', 'new'].includes(v)) return (list.find((s) => s.group === 'notstarted') || {}).id || fallbackId
  return fallbackId
}

const DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/
/** Return a YYYY-MM-DD string if valid, else null. */
function cleanDate(value) {
  if (!value) return null
  const m = String(value).match(DATE_RE)
  if (!m) return null
  const d = new Date(m[1])
  return Number.isNaN(d.getTime()) ? null : m[1]
}

/** Build one normalised patch from a loose object (JSON path). */
function patchFromObject(obj, statuses, fallbackId) {
  const title = String(obj.title ?? obj.name ?? '').trim()
  if (!title) return null
  return {
    title: title.slice(0, 300),
    status: resolveStatus(obj.status ?? obj.state, statuses, fallbackId),
    priority: resolvePriority(obj.priority),
    type: resolveType(obj.type),
    dueDate: cleanDate(obj.dueDate ?? obj.due_date ?? obj.due),
    description: String(obj.description ?? obj.desc ?? '').trim()
  }
}

/** Parse a single text line into a patch (or null for blank/heading lines). */
function patchFromLine(rawLine, statuses, fallbackId) {
  let line = rawLine.trim()
  if (!line) return null
  if (/^#{1,6}\s+/.test(line)) return null // Markdown heading → skip

  // Strip a leading list marker: "- ", "* ", "+ ", "1. ", "1) ".
  line = line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')

  // Leading checkbox → done hint, and strip it.
  let doneHint = false
  const cb = line.match(/^\[( |x|X|✓)\]\s*/)
  if (cb) { doneHint = /[xX✓]/.test(cb[1]); line = line.slice(cb[0].length) }

  let priority
  let type
  let dueDate = null

  // @YYYY-MM-DD → due date
  line = line.replace(/(^|\s)@(\d{4}-\d{2}-\d{2})(?=\s|$)/g, (_m, pre, d) => { dueDate = cleanDate(d); return pre }).trim()
  // !priority
  line = line.replace(/(^|\s)!([a-z]+)(?=\s|$)/gi, (_m, pre, p) => { priority = resolvePriority(p); return pre }).trim()
  // #type — only consume when it's a recognised type, so a plain "#3" stays in the title.
  line = line.replace(/(^|\s)#([a-z]+)(?=\s|$)/gi, (_m, pre, tag) => {
    const t = norm(tag)
    if (TYPE_IDS.includes(t) || TYPE_ALIASES[t]) { type = resolveType(t); return pre }
    return `${pre}#${tag}`
  }).trim()

  const title = line.replace(/\s{2,}/g, ' ').trim()
  if (!title) return null
  return {
    title: title.slice(0, 300),
    status: resolveStatus('', statuses, fallbackId, doneHint),
    priority: priority || 'medium',
    type: type || 'general',
    dueDate,
    description: ''
  }
}

/** Best-effort detection so the UI can label the input and pick a parser. */
export function detectFormat(raw) {
  const s = (raw || '').trim()
  if (!s) return 'empty'
  return (s[0] === '[' || s[0] === '{') ? 'json' : 'text'
}

/**
 * Parse pasted text into task patches.
 * @param {string} raw
 * @param {object} opts
 * @param {Array} opts.statuses      the board's live statuses (for validation)
 * @param {string} opts.fallbackId   default status id for unresolved/blank statuses
 * @returns {{ format:string, tasks:Array, errors:string[], skipped:number }}
 */
export function parseTasksInput(raw, { statuses = [], fallbackId = 'not_started' } = {}) {
  const format = detectFormat(raw)
  const errors = []
  const tasks = []
  let skipped = 0

  if (format === 'empty') return { format, tasks, errors, skipped }

  if (format === 'json') {
    let data
    try {
      data = JSON.parse(raw)
    } catch (e) {
      return { format, tasks, errors: [`Invalid JSON: ${e.message}`], skipped }
    }
    const arr = Array.isArray(data) ? data : Array.isArray(data?.tasks) ? data.tasks : null
    if (!arr) return { format, tasks, errors: ['JSON must be an array of tasks, or { "tasks": [ … ] }.'], skipped }
    arr.forEach((obj, i) => {
      if (obj && typeof obj === 'object') {
        const patch = patchFromObject(obj, statuses, fallbackId)
        if (patch) tasks.push(patch)
        else { skipped++; errors.push(`Item ${i + 1} skipped: missing a title.`) }
      } else {
        skipped++
        errors.push(`Item ${i + 1} skipped: not an object.`)
      }
    })
    return { format, tasks, errors, skipped }
  }

  // TEXT
  for (const rawLine of raw.split(/\r\n?|\n/)) {
    const patch = patchFromLine(rawLine, statuses, fallbackId)
    if (patch) tasks.push(patch)
    else if (rawLine.trim()) skipped++ // a heading or non-task line
  }
  return { format, tasks, errors, skipped }
}
