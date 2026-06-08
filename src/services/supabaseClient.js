/**
 * supabaseClient.js
 * ----------------------------------------------------------------------------
 * Creates and exports the single shared Supabase client.
 *
 * IMPORTANT DESIGN CHOICE — DEMO MODE:
 * If the environment variables are not set, we DO NOT create a client and
 * instead expose `isSupabaseConfigured === false`. Every service checks this
 * flag and falls back to local sample data, so the whole application runs and
 * can be demonstrated offline (e.g. during marking) without a live backend.
 * When real credentials are provided in `.env`, the exact same code paths use
 * the live database and realtime channels.
 */

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True only when both credentials are present. */
export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * The Supabase client, or null in demo mode. Always check
 * `isSupabaseConfigured` before using it.
 * @type {import('@supabase/supabase-js').SupabaseClient | null}
 */
export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      },
      realtime: {
        params: { eventsPerSecond: 10 }
      }
    })
  : null

if (!isSupabaseConfigured) {
  // A friendly, one-time console hint for developers/markers.
  // eslint-disable-next-line no-console
  console.info(
    '%c[StudySync] Running in DEMO MODE — Supabase env vars not set. Using local sample data.',
    'color:#4f46e5;font-weight:bold'
  )
}
