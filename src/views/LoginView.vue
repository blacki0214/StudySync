<script setup>
/**
 * LoginView — email/password sign-in. Validates client-side, then delegates to
 * the auth store. In demo mode any credentials succeed.
 */
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/authStore.js'
import { isSupabaseConfigured } from '../services/supabaseClient.js'
import { validateEmail, validatePassword, firstError } from '../utils/validation.js'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref(null)

async function submit() {
  error.value = firstError([validateEmail(email.value), validatePassword(password.value)])
  if (error.value) return

  try {
    await auth.login({ email: email.value, password: password.value })
    router.push(route.query.redirect || '/dashboard')
  } catch (e) {
    error.value = auth.error || 'Login failed.'
  }
}
</script>

<template>
  <div class="auth-wrap">
    <aside class="auth-aside">
      <h2>Welcome back 👋</h2>
      <p class="mb-4">Pick up where you left off — your notes, flashcards and study rooms are waiting.</p>
      <ul>
        <li><i class="bi bi-check-circle-fill"></i> Real-time collaborative notes</li>
        <li><i class="bi bi-check-circle-fill"></i> Auto-generated flashcards &amp; quizzes</li>
        <li><i class="bi bi-check-circle-fill"></i> Live study rooms with presence</li>
      </ul>
    </aside>

    <div class="auth-form-panel">
      <div class="auth-card">
        <h1>Log in</h1>
        <p class="auth-sub">Enter your details to continue.</p>

        <div v-if="!isSupabaseConfigured" class="demo-hint">
          <i class="bi bi-info-circle me-1"></i>
          <strong>Demo mode:</strong> any email &amp; password (6+ chars) will sign you in.
        </div>

        <form @submit.prevent="submit">
          <div class="form-group">
            <label>Email</label>
            <input v-model="email" type="email" class="form-control" placeholder="you@university.edu.vn" />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input v-model="password" type="password" class="form-control" placeholder="••••••••" />
          </div>

          <p v-if="error" class="form-error"><i class="bi bi-exclamation-circle me-1"></i>{{ error }}</p>

          <button class="btn btn-brand w-100" :disabled="auth.loading">
            <span v-if="auth.loading" class="spinner-border spinner-border-sm me-2"></span>
            Log in
          </button>
        </form>

        <p class="auth-alt">
          No account? <router-link to="/register">Create one</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
