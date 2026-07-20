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

/** True when real credentials exist in .env. Never changes at runtime. */
export const hasSupabaseCredentials = Boolean(url && anonKey)

/**
 * The EFFECTIVE flag every service gates on. It starts as
 * `hasSupabaseCredentials` but is forced to false while a dev test account is
 * signed in, so those sessions read/write localStorage instead of hitting
 * Postgres with a non-UUID owner_id. This is an `export let` on purpose — ES
 * module bindings are live, so reassigning it here updates every importer.
 */
export let isSupabaseConfigured = hasSupabaseCredentials

/**
 * Route all data access to localStorage (on) or back to Supabase (off).
 * Called by authService when a test account signs in / out.
 */
export function setLocalDataMode(on) {
  isSupabaseConfigured = on ? false : hasSupabaseCredentials
}

// A test session already in localStorage must survive a page refresh, so apply
// local mode before any store loads. Read the key directly to avoid importing
// authService (which imports this module).
try {
  const saved = JSON.parse(localStorage.getItem('studysync_demo_session') || 'null')
  if (saved?.__test) setLocalDataMode(true)
} catch { /* no/invalid session — stay with the real credentials */ }

/**
 * The Supabase client, or null when no credentials exist. Built from the raw
 * credentials so it stays usable after a test session ends. Always check
 * `isSupabaseConfigured` before using it.
 * @type {import('@supabase/supabase-js').SupabaseClient | null}
 */
export const supabase = hasSupabaseCredentials
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
  const why = hasSupabaseCredentials
    ? 'signed in with a dev test account'
    : 'Supabase env vars not set'
  // eslint-disable-next-line no-console
  console.info(
    `%c[StudySync] Running in LOCAL DATA MODE — ${why}. Using localStorage.`,
    'color:#4f46e5;font-weight:bold'
  )
}
