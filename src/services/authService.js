/**
 * authService.js
 * ----------------------------------------------------------------------------
 * Thin wrapper around Supabase Auth. In demo mode it simulates a logged-in
 * student so the protected pages remain explorable.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { currentUser } from '../data/sampleUsers.js'

// A fake session used when no backend is configured — the signed-in student
// from the Figma mockups, carrying gamification fields (XP, streak, tier).
const DEMO_USER = {
  ...currentUser,
  avatar_url: currentUser.avatar
}

const DEMO_STORAGE_KEY = 'studysync_demo_session'

export const authService = {
  /**
   * Register a new account. Returns the created user (or demo user).
   */
  async signUp({ email, password, fullName }) {
    if (!isSupabaseConfigured) {
      const user = { ...DEMO_USER, email, full_name: fullName }
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(user))
      return user
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    })
    if (error) throw error

    // Create the matching profile row.
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        email,
        reputation: 0
      })
    }
    return mapUser(data.user, fullName)
  },

  /**
   * Sign in with email + password.
   */
  async signIn({ email, password }) {
    if (!isSupabaseConfigured) {
      const user = { ...DEMO_USER, email }
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(user))
      return user
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return mapUser(data.user)
  },

  /**
   * Sign out the current user.
   */
  async signOut() {
    if (!isSupabaseConfigured) {
      localStorage.removeItem(DEMO_STORAGE_KEY)
      return
    }
    await supabase.auth.signOut()
  },

  /**
   * Return the currently authenticated user, or null.
   */
  async getCurrentUser() {
    if (!isSupabaseConfigured) {
      const raw = localStorage.getItem(DEMO_STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    }

    const { data } = await supabase.auth.getUser()
    if (!data.user) return null

    // Pull the richer profile row to get full_name / reputation.
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    return profile || mapUser(data.user)
  }
}

/** Normalise a Supabase auth user into our app's user shape. */
function mapUser(user, fullName) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    full_name: fullName || user.user_metadata?.full_name || user.email,
    avatar_url: user.user_metadata?.avatar_url || '',
    reputation: 0
  }
}
