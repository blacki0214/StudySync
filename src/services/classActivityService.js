/**
 * classActivityService.js
 * ----------------------------------------------------------------------------
 * Phase 5: class-private discussions (Q&A) + attendance. Kept in one service
 * since both are lightweight class-scoped activity logs. Demo mode persists to
 * localStorage; live mode uses Supabase (supabase/migration_class_activity.sql).
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'

const K_THREADS = 'studysync_demo_class_threads'
const K_REPLIES = 'studysync_demo_class_replies'
const K_ATTEND = 'studysync_demo_class_attendance'
let counter = 13000
const nextId = (p) => `${p}-${++counter}`

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v))

export const classActivityService = {
  // --- Discussions --------------------------------------------------------
  async listThreads(classId) {
    if (!isSupabaseConfigured) {
      const replies = read(K_REPLIES)
      return read(K_THREADS).filter((th) => th.class_id === classId)
        .map((th) => ({ ...th, reply_count: replies.filter((r) => r.thread_id === th.id).length }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
    const { data, error } = await supabase
      .from('class_discussions').select('*, author:profiles(*)').eq('class_id', classId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async createThread({ classId, authorId, authorName, title, body }) {
    if (!isSupabaseConfigured) {
      const row = { id: nextId('thread'), class_id: classId, author_id: authorId, author: { full_name: authorName }, title: title.trim(), body: (body || '').trim(), created_at: new Date().toISOString(), reply_count: 0 }
      const list = read(K_THREADS); list.unshift(row); write(K_THREADS, list)
      return row
    }
    const { data, error } = await supabase
      .from('class_discussions').insert({ class_id: classId, author_id: authorId, title: title.trim(), body: (body || '').trim() })
      .select('*, author:profiles(*)').single()
    if (error) throw error
    return data
  },

  async listReplies(threadId) {
    if (!isSupabaseConfigured) {
      return read(K_REPLIES).filter((r) => r.thread_id === threadId)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    }
    const { data, error } = await supabase
      .from('class_discussion_replies').select('*, author:profiles(*)').eq('thread_id', threadId).order('created_at')
    if (error) throw error
    return data
  },

  async addReply({ threadId, authorId, authorName, body }) {
    if (!isSupabaseConfigured) {
      const row = { id: nextId('reply'), thread_id: threadId, author_id: authorId, author: { full_name: authorName }, body: body.trim(), created_at: new Date().toISOString() }
      const list = read(K_REPLIES); list.push(row); write(K_REPLIES, list)
      return row
    }
    const { data, error } = await supabase
      .from('class_discussion_replies').insert({ thread_id: threadId, author_id: authorId, body: body.trim() })
      .select('*, author:profiles(*)').single()
    if (error) throw error
    return data
  },

  // --- Attendance ---------------------------------------------------------
  /** Attendance records for a class on a given date (ISO yyyy-mm-dd). */
  async getAttendance(classId, date) {
    if (!isSupabaseConfigured) {
      return read(K_ATTEND).filter((a) => a.class_id === classId && a.date === date)
    }
    const { data, error } = await supabase
      .from('class_attendance').select('*').eq('class_id', classId).eq('date', date)
    if (error) throw error
    return data
  },

  async setAttendance({ classId, date, userId, present }) {
    if (!isSupabaseConfigured) {
      const list = read(K_ATTEND).filter((a) => !(a.class_id === classId && a.date === date && a.user_id === userId))
      list.push({ id: nextId('att'), class_id: classId, date, user_id: userId, present })
      write(K_ATTEND, list)
      return
    }
    const { error } = await supabase
      .from('class_attendance')
      .upsert({ class_id: classId, date, user_id: userId, present }, { onConflict: 'class_id,date,user_id' })
    if (error) throw error
  }
}
