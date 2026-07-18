/**
 * classService.js
 * ----------------------------------------------------------------------------
 * Teacher-owned classes + student enrollment (join by code) + announcements.
 * Live mode uses Supabase; demo mode keeps classes/members/announcements in
 * localStorage so the whole flow works offline. RLS (live) enforces ownership.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { generateJoinCode } from '../utils/joinCode.js'
import { schoolService } from './schoolService.js'

const K_CLASSES = 'studysync_demo_classes'
const K_MEMBERS = 'studysync_demo_class_members'
const K_ANN = 'studysync_demo_announcements'
let counter = 8000
const nextId = (p) => `${p}-${++counter}`

const read = (k) => {
  try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] }
}
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v))

export const classService = {
  /** Classes the user owns (teacher). */
  async listMyClasses(ownerId) {
    if (!isSupabaseConfigured) {
      return read(K_CLASSES).filter((c) => c.owner_id === ownerId)
    }
    const { data, error } = await supabase
      .from('classes').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  /** Classes the user is enrolled in (student). */
  async listEnrolledClasses(userId) {
    if (!isSupabaseConfigured) {
      const myMemberships = read(K_MEMBERS).filter((m) => m.user_id === userId).map((m) => m.class_id)
      return read(K_CLASSES).filter((c) => myMemberships.includes(c.id))
    }
    const { data, error } = await supabase
      .from('class_members').select('class:classes(*)').eq('user_id', userId)
    if (error) throw error
    return (data || []).map((r) => r.class).filter(Boolean)
  },

  async getClass(id) {
    if (!isSupabaseConfigured) return read(K_CLASSES).find((c) => c.id === id) || null
    const { data, error } = await supabase.from('classes').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },

  async getClassByCode(code) {
    const clean = (code || '').trim().toUpperCase()
    if (!isSupabaseConfigured) return read(K_CLASSES).find((c) => c.code === clean) || null
    const { data, error } = await supabase.from('classes').select('*').eq('code', clean).maybeSingle()
    if (error) throw error
    return data
  },

  /** Create a class with a unique join code. `schoolId` links it to a school. */
  async createClass({ ownerId, name, description = '', color = 'grad-blue', schoolId = null }) {
    if (!isSupabaseConfigured) {
      const existing = new Set(read(K_CLASSES).map((c) => c.code))
      let code = generateJoinCode()
      while (existing.has(code)) code = generateJoinCode()
      const row = {
        id: nextId('class'), owner_id: ownerId, name: name.trim(), description,
        code, color, school_id: schoolId || null, archived: false, created_at: new Date().toISOString()
      }
      const list = read(K_CLASSES); list.unshift(row); write(K_CLASSES, list)
      return row
    }
    // Retry a few times in case of a code collision (unique constraint).
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateJoinCode()
      const { data, error } = await supabase
        .from('classes')
        .insert({ owner_id: ownerId, name: name.trim(), description, color, code, school_id: schoolId })
        .select().single()
      if (!error) return data
      if (!/duplicate|unique/i.test(error.message)) throw error
    }
    throw new Error('Could not generate a unique class code, please try again.')
  },

  async deleteClass(id) {
    if (!isSupabaseConfigured) {
      write(K_CLASSES, read(K_CLASSES).filter((c) => c.id !== id))
      write(K_MEMBERS, read(K_MEMBERS).filter((m) => m.class_id !== id))
      write(K_ANN, read(K_ANN).filter((a) => a.class_id !== id))
      return
    }
    const { error } = await supabase.from('classes').delete().eq('id', id)
    if (error) throw error
  },

  /** Student joins a class by code. Returns the class. */
  async joinByCode({ code, userId, userName }) {
    const cls = await this.getClassByCode(code)
    if (!cls) { const e = new Error('No class found for that code.'); e.code = 'not_found'; throw e }

    if (!isSupabaseConfigured) {
      const members = read(K_MEMBERS)
      if (members.some((m) => m.class_id === cls.id && m.user_id === userId)) {
        const e = new Error('You have already joined this class.'); e.code = 'already_member'; throw e
      }
      members.unshift({ id: nextId('mem'), class_id: cls.id, user_id: userId, full_name: userName, role: 'member', joined_at: new Date().toISOString() })
      write(K_MEMBERS, members)
      // Implicit school membership: joining a school-owned class enrols you as a
      // student of that school.
      if (cls.school_id) await schoolService.ensureMembership({ schoolId: cls.school_id, userId, userName, role: 'student' })
      return cls
    }

    const { error } = await supabase.from('class_members').insert({ class_id: cls.id, user_id: userId })
    if (error) {
      if (/duplicate|unique/i.test(error.message)) { const e = new Error('You have already joined this class.'); e.code = 'already_member'; throw e }
      throw error
    }
    if (cls.school_id) await schoolService.ensureMembership({ schoolId: cls.school_id, userId, userName, role: 'student' })
    return cls
  },

  /** Roster of enrolled students (with their profile info). */
  async getRoster(classId) {
    if (!isSupabaseConfigured) {
      return read(K_MEMBERS).filter((m) => m.class_id === classId)
        .map((m) => ({ ...m, profile: { full_name: m.full_name || 'Student' } }))
    }
    const { data, error } = await supabase
      .from('class_members').select('*, profile:profiles(*)').eq('class_id', classId).order('joined_at')
    if (error) throw error
    return data
  },

  async removeMember(member) {
    if (!isSupabaseConfigured) {
      write(K_MEMBERS, read(K_MEMBERS).filter((m) => m.id !== member.id))
      return
    }
    const { error } = await supabase.from('class_members').delete().eq('id', member.id)
    if (error) throw error
  },

  async setMemberRole(member, role) {
    if (!isSupabaseConfigured) {
      const list = read(K_MEMBERS); const m = list.find((x) => x.id === member.id); if (m) m.role = role
      write(K_MEMBERS, list); return
    }
    const { error } = await supabase.from('class_members').update({ role }).eq('id', member.id)
    if (error) throw error
  },

  async listAnnouncements(classId) {
    if (!isSupabaseConfigured) {
      return read(K_ANN).filter((a) => a.class_id === classId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
    const { data, error } = await supabase
      .from('class_announcements').select('*, author:profiles(*)').eq('class_id', classId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data
  },

  async postAnnouncement({ classId, authorId, authorName, body }) {
    if (!isSupabaseConfigured) {
      const row = { id: nextId('ann'), class_id: classId, author_id: authorId, body: body.trim(), created_at: new Date().toISOString(), author: { full_name: authorName } }
      const list = read(K_ANN); list.unshift(row); write(K_ANN, list)
      return row
    }
    const { data, error } = await supabase
      .from('class_announcements').insert({ class_id: classId, author_id: authorId, body: body.trim() })
      .select('*, author:profiles(*)').single()
    if (error) throw error
    return data
  },

  async deleteAnnouncement(id) {
    if (!isSupabaseConfigured) {
      write(K_ANN, read(K_ANN).filter((a) => a.id !== id)); return
    }
    const { error } = await supabase.from('class_announcements').delete().eq('id', id)
    if (error) throw error
  }
}
