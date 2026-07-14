/**
 * authService.js
 * ----------------------------------------------------------------------------
 * Wrapper around Supabase Auth. Handles the multi-step signup (collecting name,
 * DOB, phone, role and purpose), email-confirmation, login and password reset.
 * In demo mode (no Supabase configured) it simulates everything against
 * localStorage so the whole flow is explorable offline.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import { currentUser } from '../data/sampleUsers.js'

const DEMO_STORAGE_KEY = 'studysync_demo_session'

/** The post-confirmation landing page (where Supabase sends the email link). */
function welcomeRedirect() {
  return typeof window !== 'undefined' ? `${window.location.origin}/welcome` : undefined
}
function resetRedirect() {
  return typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined
}

export const authService = {
  /**
   * Register a new account.
   * @returns {Promise<{ needsConfirmation: boolean, user: object|null }>}
   *   needsConfirmation=true means an email was sent and there is no session yet.
   */
  async signUp({ email, password, firstName, lastName, dob, phone, role, purpose }) {
    const fullName = `${firstName || ''} ${lastName || ''}`.trim()

    if (!isSupabaseConfigured) {
      // Demo mode: pretend an account was made and sign straight in.
      const user = {
        ...currentUser,
        id: 'demo-user',
        email,
        full_name: fullName || currentUser.full_name,
        first_name: firstName,
        last_name: lastName,
        dob,
        phone,
        role,
        purpose,
        avatar_url: ''
      }
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(user))
      return { needsConfirmation: false, user }
    }

    const cleanEmail = (email || '').trim().toLowerCase()
    const emailExists = () => {
      const err = new Error('An account with this email already exists.')
      err.code = 'email_exists'
      return err
    }

    // Reject duplicates up-front (case-insensitive) for a clear message.
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', cleanEmail)
      .limit(1)
    if (existing && existing.length) throw emailExists()

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: welcomeRedirect(),
        data: { full_name: fullName, first_name: firstName, last_name: lastName, role, purpose }
      }
    })
    if (error) {
      if (/already|registered|exists/i.test(error.message)) throw emailExists()
      throw error
    }
    // When "Confirm email" is ON, Supabase hides duplicates by returning a user
    // with an empty identities array instead of an error — detect that too.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw emailExists()
    }

    // Create the matching profile row (id == auth user id so it lines up later).
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        auth_id: data.user.id,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        email: cleanEmail,
        dob: dob || null,
        phone,
        role,
        purpose,
        reputation: 0
      })
    }

    // No session yet => email confirmation is required.
    return { needsConfirmation: !data.session, user: data.user ? mapUser(data.user, fullName) : null }
  },

  /** Sign in with email + password. */
  async signIn({ email, password }) {
    if (!isSupabaseConfigured) {
      const raw = localStorage.getItem(DEMO_STORAGE_KEY)
      const base = raw ? JSON.parse(raw) : { ...currentUser }
      const user = { ...base, email }
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(user))
      return user
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // Friendlier message for the common "not confirmed yet" case.
      if (/confirm/i.test(error.message)) {
        const err = new Error('Please confirm your email first — check your inbox.')
        err.code = 'not_confirmed'
        throw err
      }
      throw error
    }
    return this.getCurrentUser()
  },

  /** Sign out the current user. */
  async signOut() {
    if (!isSupabaseConfigured) {
      localStorage.removeItem(DEMO_STORAGE_KEY)
      return
    }
    await supabase.auth.signOut()
  },

  /** Return the currently authenticated user, or null. */
  async getCurrentUser() {
    if (!isSupabaseConfigured) {
      const raw = localStorage.getItem(DEMO_STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    }

    const { data } = await supabase.auth.getUser()
    if (!data.user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    return profile || mapUser(data.user)
  },

  /** Send a password-reset email. */
  async requestPasswordReset(email) {
    if (!isSupabaseConfigured) return // demo: silently "succeed"
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirect()
    })
    if (error) throw error
  },

  /** Set a new password (used on the reset-password page after the email link). */
  async updatePassword(newPassword) {
    if (!isSupabaseConfigured) return
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  },

  /**
   * Update the current user's profile (name, avatar, bio, banner colour, …).
   * Returns the merged/updated user object. Demo mode writes to localStorage.
   */
  async updateProfile(patch = {}) {
    if (!isSupabaseConfigured) {
      const raw = localStorage.getItem(DEMO_STORAGE_KEY)
      const base = raw ? JSON.parse(raw) : { ...currentUser }
      const user = { ...base, ...patch }
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(user))
      return user
    }
    const { data: session } = await supabase.auth.getUser()
    if (!session.user) throw new Error('Not signed in')
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', session.user.id)
      .select()
      .single()
    if (error) throw error
    return data
  }
}

/** Normalise a Supabase auth user into our app's user shape. */
function mapUser(user, fullName) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    full_name: fullName || user.user_metadata?.full_name || user.email,
    first_name: user.user_metadata?.first_name || '',
    last_name: user.user_metadata?.last_name || '',
    role: user.user_metadata?.role || '',
    purpose: user.user_metadata?.purpose || '',
    avatar_url: user.user_metadata?.avatar_url || '',
    reputation: 0
  }
}
