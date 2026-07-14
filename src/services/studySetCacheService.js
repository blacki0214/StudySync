/**
 * studySetCacheService.js
 * ----------------------------------------------------------------------------
 * Per-user cache for AI-generated study material (flashcards, quiz, summary,
 * keywords). Generating these costs AI credits, and the views used to re-run
 * generation on EVERY visit/navigation. This caches the result per user, keyed
 * by (kind, source) — e.g. a note or a subject's source corpus — plus a hash of
 * the content it was generated from, so the cache auto-invalidates when the
 * underlying note/corpus changes.
 *
 * Flow at every call site:
 *   • On open  -> reuse the cached set when the content hash still matches.
 *   • Regenerate button -> force a fresh AI call, then overwrite the cache.
 *
 * Mirrors the app-wide demo-mode pattern: when Supabase is configured it reads/
 * writes `generated_study_sets`; otherwise it uses localStorage so caching still
 * works offline (e.g. during marking).
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const LS_KEY = 'studysync_studyset_cache_v1'

/**
 * Stable, fast, non-crypto hash (FNV-1a) → hex string. Used to detect when the
 * source content has changed since the cached set was generated.
 * @param {string} str
 * @returns {string}
 */
export function hashContent(str = '') {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

// --- localStorage backend (demo mode) --------------------------------------
function readLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
function writeLocal(obj) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)) } catch { /* quota — ignore */ }
}
function localKey(userId, kind, sourceKey) {
  return `${userId}::${kind}::${sourceKey}`
}

/**
 * Read a cached study set, but only return it when the content hash still
 * matches (otherwise the source has changed and the set is stale).
 * @returns {Promise<any|null>} the cached payload, or null on miss/stale/error.
 */
export async function getCachedSet({ userId, kind, sourceKey, contentHash }) {
  if (!userId || !sourceKey) return null

  if (!isSupabaseConfigured || !supabase) {
    const row = readLocal()[localKey(userId, kind, sourceKey)]
    return row && row.content_hash === contentHash ? row.payload : null
  }

  const { data, error } = await supabase
    .from('generated_study_sets')
    .select('payload, content_hash')
    .eq('user_id', userId)
    .eq('kind', kind)
    .eq('source_key', sourceKey)
    .maybeSingle()
  if (error || !data) return null
  return data.content_hash === contentHash ? data.payload : null
}

/**
 * Upsert a cached study set (one row per user+kind+source). Best-effort: a
 * failure to persist must never break generation, so errors are swallowed.
 */
export async function saveCachedSet({ userId, kind, sourceKey, contentHash, payload }) {
  if (!userId || !sourceKey) return

  if (!isSupabaseConfigured || !supabase) {
    const all = readLocal()
    all[localKey(userId, kind, sourceKey)] = { content_hash: contentHash, payload }
    writeLocal(all)
    return
  }

  const { error } = await supabase
    .from('generated_study_sets')
    .upsert(
      { user_id: userId, kind, source_key: sourceKey, content_hash: contentHash, payload, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,kind,source_key' }
    )
  if (error) console.warn('[studyset] cache save failed:', error.message)
}

/**
 * Get-or-generate: return the cached set for this (user, kind, source, content)
 * when available, otherwise run `generator`, cache the result, and return it.
 *
 * @param {object}   opts
 * @param {string}   opts.userId
 * @param {string}   opts.kind        'flashcards' | 'quiz' | 'summary' | 'keywords'
 * @param {string}   opts.sourceKey   stable id for the source, e.g. `note:<id>` / `subject:<id>`
 * @param {string}   opts.content     the text the set is generated from (hashed)
 * @param {object}   [opts.options]   generation options (folded into the hash)
 * @param {Function} opts.generator   async (content, options) => payload
 * @param {boolean}  [opts.force]     skip the cache and regenerate (Regenerate button)
 * @returns {Promise<{ data:any, cached:boolean }>}
 */
export async function cachedGenerate({ userId, kind, sourceKey, content, options = {}, generator, force = false }) {
  const contentHash = hashContent(`${kind}:${JSON.stringify(options)}:${content}`)

  if (!force) {
    const cached = await getCachedSet({ userId, kind, sourceKey, contentHash })
    if (cached) return { data: cached, cached: true }
  }

  const data = await generator(content, options)
  const hasData = Array.isArray(data) ? data.length > 0 : Boolean(data)
  if (hasData) {
    await saveCachedSet({ userId, kind, sourceKey, contentHash, payload: data })
  }
  return { data, cached: false }
}

export const studySetCacheService = { hashContent, getCachedSet, saveCachedSet, cachedGenerate }
export default studySetCacheService
