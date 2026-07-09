/**
 * communityService.js
 * ----------------------------------------------------------------------------
 * Persists community Q&A posts and vote counts. Mirrors the demo-mode pattern
 * used across the app: when Supabase is configured it writes to the
 * `community_posts` table; otherwise it synthesises a local post object so
 * posting/voting still work offline (and for marking).
 *
 * Returns posts in the shape contentStore/CommunityView expect:
 *   { id, author_id, subject, subject_code, badge, ago, votes, title, excerpt,
 *     tags, replies, answered, created_at }
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { timeAgo } from '../utils/formatDate.js'

function localId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

// Pull "#tags" out of free text so a quick question still gets categorised.
function parseTags(text) {
  const found = String(text || '').match(/#[\p{L}\d_]+/gu) || []
  return [...new Set(found)].slice(0, 4)
}

/**
 * Create a community post.
 * @param {object} input
 * @param {string} input.title
 * @param {string} [input.excerpt]
 * @param {string} [input.subjectCode]
 * @param {string[]} [input.tags]
 * @param {object} [input.author]  the current user (for badge/name in demo)
 * @returns {Promise<object>} the created post (contentStore shape)
 */
export async function createPost({ title, excerpt = '', subjectCode = '', tags = [], author = null }) {
  const cleanTitle = String(title || '').trim()
  const finalTags = tags.length ? tags : parseTags(`${title} ${excerpt}`)

  // Demo mode: synthesise a local post so the feed updates without a backend.
  if (!isSupabaseConfigured || !supabase) {
    return {
      id: localId('post'),
      author_id: author?.id || 'user-1',
      subject: subjectCode,
      subject_code: subjectCode,
      badge: author?.program || '',
      ago: 'just now',
      votes: 0,
      title: cleanTitle,
      excerpt: String(excerpt || '').trim(),
      tags: finalTags,
      replies: 0,
      answered: false,
      created_at: new Date().toISOString()
    }
  }

  // Live: insert and return in the mapped shape.
  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      author_id: author?.id || null,
      subject_code: subjectCode || null,
      title: cleanTitle,
      excerpt: String(excerpt || '').trim(),
      tags: finalTags,
      votes: 0,
      replies: 0,
      answered: false
    })
    .select('*, author:profiles(*)')
    .single()
  if (error) throw error

  return {
    ...data,
    subject: data.subject_code,
    badge: data.author?.program || '',
    ago: timeAgo(data.created_at)
  }
}

/**
 * Persist a post's vote count. `votes` is the NEW absolute count (the caller
 * has already applied the optimistic +1/-1), so we just write it. No-op in
 * demo mode — the local reactive state already holds the change.
 */
export async function setVotes(postId, votes) {
  if (!isSupabaseConfigured || !supabase) return
  const { error } = await supabase
    .from('community_posts')
    .update({ votes })
    .eq('id', postId)
  if (error) throw error
}

export const communityService = { createPost, setVotes }
export default communityService
