/**
 * feedbackService.js
 * ----------------------------------------------------------------------------
 * Write-side for the "Send feedback" form in the Help centre. Follows the same
 * demo-mode gate as the other services: with Supabase configured the message
 * goes to the `feedback` table (see supabase/migration_feedback.sql); without
 * it, the message is kept in localStorage so the form still works offline and
 * during marking.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const DEMO_KEY = 'studysync_demo_feedback'

function readDemo() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY)) || []
  } catch {
    return []
  }
}

export const feedbackService = {
  /**
   * Submit one piece of feedback.
   * @param {{ userId?: string, kind: string, message: string, email?: string, page?: string }} payload
   */
  async submit({ userId = null, kind = 'other', message, email = null, page = null }) {
    const row = {
      user_id: userId,
      kind,
      message: (message || '').trim(),
      email: email || null,
      page,
      created_at: new Date().toISOString()
    }
    if (!row.message) throw new Error('Feedback message is empty.')

    if (!isSupabaseConfigured) {
      const all = readDemo()
      all.unshift({ id: `demo-${all.length + 1}`, ...row })
      localStorage.setItem(DEMO_KEY, JSON.stringify(all.slice(0, 50)))
      return row
    }

    const { data, error } = await supabase.from('feedback').insert(row).select().single()
    if (error) throw error
    return data
  }
}

export default feedbackService
