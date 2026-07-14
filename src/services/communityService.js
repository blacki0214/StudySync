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

// ---------------------------------------------------------------------------
// Replies (comments) + saved posts (bookmarks)
// ---------------------------------------------------------------------------

const C_KEY = 'studysync_demo_community_comments' // [{ id, post_id, author_id, author_name, body, created_at }]
const S_KEY = 'studysync_demo_community_saves'    // [{ user_id, post_id }]
const readLS = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* ignore */ } }

/** List a post's replies, oldest first, with author info. */
export async function listComments(postId) {
  if (!isSupabaseConfigured || !supabase) {
    return readLS(C_KEY)
      .filter((c) => c.post_id === postId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((c) => ({ ...c, author: { full_name: c.author_name }, ago: timeAgo(c.created_at) }))
  }
  const { data, error } = await supabase
    .from('community_comments')
    .select('*, author:profiles(full_name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []).map((c) => ({ ...c, ago: timeAgo(c.created_at) }))
}

/** Add a reply and bump the post's reply count. Returns the created comment. */
export async function addComment({ postId, body, author, newReplyCount }) {
  const clean = String(body || '').trim()
  if (!clean) throw new Error('Empty comment')

  if (!isSupabaseConfigured || !supabase) {
    const row = {
      id: localId('cmt'), post_id: postId, author_id: author?.id || 'demo-user',
      author_name: author?.full_name || 'You', body: clean, created_at: new Date().toISOString()
    }
    writeLS(C_KEY, [...readLS(C_KEY), row])
    return { ...row, author: { full_name: row.author_name }, ago: 'just now' }
  }

  const { data, error } = await supabase
    .from('community_comments')
    .insert({ post_id: postId, author_id: author?.id || null, body: clean })
    .select('*, author:profiles(full_name, avatar_url)')
    .single()
  if (error) throw error
  // Keep the denormalised reply count on the post in sync.
  await supabase.from('community_posts').update({ replies: newReplyCount }).eq('id', postId)
  return { ...data, ago: timeAgo(data.created_at) }
}

/** Delete a reply and decrement the post's reply count. */
export async function deleteComment({ id, postId, newReplyCount }) {
  if (!isSupabaseConfigured || !supabase) {
    writeLS(C_KEY, readLS(C_KEY).filter((c) => c.id !== id))
    return
  }
  const { error } = await supabase.from('community_comments').delete().eq('id', id)
  if (error) throw error
  await supabase.from('community_posts').update({ replies: newReplyCount }).eq('id', postId)
}

/** The set of post ids the user has saved (bookmarked). */
export async function listSavedIds(userId) {
  if (!userId) return new Set()
  if (!isSupabaseConfigured || !supabase) {
    return new Set(readLS(S_KEY).filter((s) => s.user_id === userId).map((s) => s.post_id))
  }
  const { data, error } = await supabase.from('community_saves').select('post_id').eq('user_id', userId)
  if (error) return new Set()
  return new Set((data || []).map((r) => r.post_id))
}

/** Save or unsave a post for the user. */
export async function toggleSave({ userId, postId, saved }) {
  if (!userId) return
  if (!isSupabaseConfigured || !supabase) {
    const rows = readLS(S_KEY).filter((s) => !(s.user_id === userId && s.post_id === postId))
    if (saved) rows.push({ user_id: userId, post_id: postId })
    writeLS(S_KEY, rows)
    return
  }
  if (saved) {
    const { error } = await supabase.from('community_saves').upsert({ user_id: userId, post_id: postId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
    if (error) throw error
  } else {
    const { error } = await supabase.from('community_saves').delete().eq('user_id', userId).eq('post_id', postId)
    if (error) throw error
  }
}

export const communityService = {
  createPost, setVotes, listComments, addComment, deleteComment, listSavedIds, toggleSave
}
export default communityService
