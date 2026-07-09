/**
 * scheduleService.js
 * ----------------------------------------------------------------------------
 * Read-side for the Schedule/Calendar. It surfaces every DATED task the user
 * has (personal or subject-scoped). Class-assignment deadlines are aggregated
 * in scheduleStore (they're fetched per class). Follows the demo-mode gate: in
 * demo it reads the same localStorage the task tracker uses (seeded from
 * sampleTasks); live mode queries Supabase.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { sampleTasks } from '../data/sampleTasks.js'

const DEMO_KEY = 'studysync_demo_tasks'

function readDemoTasks() {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    return raw == null ? [...sampleTasks] : JSON.parse(raw)
  } catch {
    return [...sampleTasks]
  }
}

export const scheduleService = {
  /** Every task with a due date that the user can see. */
  async listDatedTasks({ userId }) {
    if (!isSupabaseConfigured) {
      return readDemoTasks().filter((t) => t.due_date)
    }
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .not('due_date', 'is', null)
    if (error) throw error
    // Keep the user's own tasks plus any subject task they can see.
    return (data || []).filter(
      (t) => t.subject_id || t.owner_id === userId || t.assignee_id === userId
    )
  }
}

export default scheduleService
