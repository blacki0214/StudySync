<script setup>
/** RegisterView — create a new account with client-side validation. */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore.js'
import { isSupabaseConfigured } from '../services/supabaseClient.js'
import {
  validateEmail,
  validatePassword,
  validateFullName,
  firstError
} from '../utils/validation.js'

const auth = useAuthStore()
const router = useRouter()

const fullName = ref('')
const email = ref('')
const password = ref('')
const error = ref(null)

async function submit() {
  error.value = firstError([
    validateFullName(fullName.value),
    validateEmail(email.value),
    validatePassword(password.value)
  ])
  if (error.value) return

  try {
    await auth.register({ email: email.value, password: password.value, fullName: fullName.value })
    router.push('/dashboard')
  } catch (e) {
    error.value = auth.error || 'Registration failed.'
  }
}
</script>

<template>
  <div class="auth-wrap">
    <aside class="auth-aside">
      <h2>Join StudySync 🚀</h2>
      <p class="mb-4">Create a free account and start collaborating with classmates today.</p>
      <ul>
        <li><i class="bi bi-check-circle-fill"></i> Share and co-edit subject notes</li>
        <li><i class="bi bi-check-circle-fill"></i> Turn notes into flashcards instantly</li>
        <li><i class="bi bi-check-circle-fill"></i> Climb the contributor leaderboard</li>
      </ul>
    </aside>

    <div class="auth-form-panel">
      <div class="auth-card">
        <h1>Create account</h1>
        <p class="auth-sub">It only takes a moment.</p>

        <div v-if="!isSupabaseConfigured" class="demo-hint">
          <i class="bi bi-info-circle me-1"></i>
          <strong>Demo mode:</strong> accounts are stored locally for this session.
        </div>

        <form @submit.prevent="submit">
          <div class="form-group">
            <label>Full name</label>
            <input v-model="fullName" type="text" class="form-control" placeholder="Nguyen Van A" />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input v-model="email" type="email" class="form-control" placeholder="you@university.edu.vn" />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input v-model="password" type="password" class="form-control" placeholder="At least 6 characters" />
          </div>

          <p v-if="error" class="form-error"><i class="bi bi-exclamation-circle me-1"></i>{{ error }}</p>

          <button class="btn btn-brand w-100" :disabled="auth.loading">
            <span v-if="auth.loading" class="spinner-border spinner-border-sm me-2"></span>
            Create account
          </button>
        </form>

        <p class="auth-alt">
          Already registered? <router-link to="/login">Log in</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
