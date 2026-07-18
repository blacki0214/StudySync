/**
 * schoolService.js
 * ----------------------------------------------------------------------------
 * The institution layer above teachers: a school owns teachers, students and
 * classes. An admin creates a school (with a join code); teachers/students join
 * by code, and a student is auto-enrolled into a school the moment they join a
 * class that belongs to it (implicit membership).
 *
 * Live mode uses Supabase (see supabase/migration_schools.sql); demo mode keeps
 * everything in localStorage so the whole flow works offline. Mirrors the
 * classService demo/live pattern.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { generateJoinCode } from '../utils/joinCode.js'

const K_SCHOOLS = 'studysync_demo_schools'
const K_SCHOOL_MEMBERS = 'studysync_demo_school_members'
const K_CLASSES = 'studysync_demo_classes' // read-only here (owned by classService)
let counter = 9000
const nextId = (p) => `${p}-${++counter}`

const read = (k) => {
  try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] }
}
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v))

export const schoolService = {
  /** The school the given user belongs to (admin, teacher or student), or null. */
  async getSchoolForUser(userId) {
    if (!isSupabaseConfigured) {
      const mem = read(K_SCHOOL_MEMBERS).find((m) => m.user_id === userId)
      if (!mem) return null
      const school = read(K_SCHOOLS).find((s) => s.id === mem.school_id) || null
      return school ? { ...school, myRole: mem.role } : null
    }
    const { data, error } = await supabase
      .from('school_members').select('role, school:schools(*)').eq('user_id', userId).maybeSingle()
    if (error) throw error
    return data?.school ? { ...data.school, myRole: data.role } : null
  },

  async getSchoolByCode(code) {
    const clean = (code || '').trim().toUpperCase()
    if (!isSupabaseConfigured) return read(K_SCHOOLS).find((s) => s.code === clean) || null
    const { data, error } = await supabase.from('schools').select('*').eq('code', clean).maybeSingle()
    if (error) throw error
    return data
  },

  /** Create a school and register the creator as its admin. Returns the school. */
  async createSchool({ adminId, adminName, name }) {
    if (!isSupabaseConfigured) {
      const existing = new Set(read(K_SCHOOLS).map((s) => s.code))
      let code = generateJoinCode()
      while (existing.has(code)) code = generateJoinCode()
      const school = { id: nextId('school'), admin_id: adminId, name: name.trim(), code, created_at: new Date().toISOString() }
      const schools = read(K_SCHOOLS); schools.unshift(school); write(K_SCHOOLS, schools)
      const members = read(K_SCHOOL_MEMBERS)
      members.unshift({ id: nextId('smem'), school_id: school.id, user_id: adminId, full_name: adminName, role: 'admin', joined_at: new Date().toISOString() })
      write(K_SCHOOL_MEMBERS, members)
      return { ...school, myRole: 'admin' }
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateJoinCode()
      const { data, error } = await supabase.from('schools').insert({ admin_id: adminId, name: name.trim(), code }).select().single()
      if (!error) {
        await supabase.from('school_members').insert({ school_id: data.id, user_id: adminId, role: 'admin' })
        return { ...data, myRole: 'admin' }
      }
      if (!/duplicate|unique/i.test(error.message)) throw error
    }
    throw new Error('Could not generate a unique school code, please try again.')
  },

  /** Join a school by code as a teacher or student. Returns the school. */
  async joinByCode({ code, userId, userName, role = 'student' }) {
    const school = await this.getSchoolByCode(code)
    if (!school) { const e = new Error('No school found for that code.'); e.code = 'not_found'; throw e }
    await this.ensureMembership({ schoolId: school.id, userId, userName, role })
    return { ...school, myRole: role }
  },

  /** Add a membership if the user isn't already in the school (idempotent). */
  async ensureMembership({ schoolId, userId, userName, role = 'student' }) {
    if (!isSupabaseConfigured) {
      const members = read(K_SCHOOL_MEMBERS)
      if (members.some((m) => m.school_id === schoolId && m.user_id === userId)) return
      members.unshift({ id: nextId('smem'), school_id: schoolId, user_id: userId, full_name: userName, role, joined_at: new Date().toISOString() })
      write(K_SCHOOL_MEMBERS, members)
      return
    }
    const { error } = await supabase.from('school_members').insert({ school_id: schoolId, user_id: userId, role })
    if (error && !/duplicate|unique/i.test(error.message)) throw error
  },

  /** All members, optionally filtered to a role ('teacher' | 'student' | 'admin'). */
  async listMembers(schoolId, role = null) {
    if (!isSupabaseConfigured) {
      let list = read(K_SCHOOL_MEMBERS).filter((m) => m.school_id === schoolId)
      if (role) list = list.filter((m) => m.role === role)
      return list.map((m) => ({ ...m, profile: { full_name: m.full_name || 'Member' } }))
    }
    let q = supabase.from('school_members').select('*, profile:profiles(*)').eq('school_id', schoolId).order('joined_at')
    if (role) q = q.eq('role', role)
    const { data, error } = await q
    if (error) throw error
    return data
  },

  async removeMember(member) {
    if (!isSupabaseConfigured) {
      write(K_SCHOOL_MEMBERS, read(K_SCHOOL_MEMBERS).filter((m) => m.id !== member.id))
      return
    }
    const { error } = await supabase.from('school_members').delete().eq('id', member.id)
    if (error) throw error
  },

  /** The school's class directory. */
  async listClasses(schoolId) {
    if (!isSupabaseConfigured) {
      return read(K_CLASSES).filter((c) => c.school_id === schoolId)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }
    const { data, error } = await supabase
      .from('classes').select('*').eq('school_id', schoolId).order('created_at', { ascending: false })
    if (error) throw error
    return data
  }
}
