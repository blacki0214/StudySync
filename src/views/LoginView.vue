<script setup>
/**
 * LoginView â€” centered email/password sign-in with a forgot-password link and a
 * show/hide password toggle. Validates client-side, then delegates to the store.
 */
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore.js'
import { isSupabaseConfigured } from '../services/supabaseClient.js'
import { validateEmail, validatePassword, firstError } from '../utils/validation.js'
import logoMark from '../assets/images/logo_2.png'

const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const showPw = ref(false)
const error = ref(null)

async function submit() {
  error.value = firstError([validateEmail(email.value), validatePassword(password.value)])
  if (error.value) return

  try {
    await auth.login({ email: email.value, password: password.value })
    // Land on the requested page, or the user's role home (admin/teacher/student).
    router.push(route.query.redirect || auth.homePath)
  } catch (e) {
    error.value = auth.error || 'Login failed.'
  }
}
</script>

<template>
  <div class="auth-screen">
    <div class="auth-box">
      <div class="auth-logo">
        <img :src="logoMark" alt="StudySync logo" />
        <span>StudySync<small>Vietnam</small></span>
      </div>

      <div class="auth-head">
        <h1>{{ t('auth.welcomeBack') }}</h1>
        <p>{{ t('auth.loginSub') }}</p>
      </div>

      <div v-if="!isSupabaseConfigured" class="demo-hint">
        <i class="bi bi-info-circle"></i> {{ t('auth.demoLogin') }}
      </div>

      <form @submit.prevent="submit">
        <div class="form-group">
          <label>{{ t('auth.email') }}</label>
          <input v-model="email" type="email" class="form-control" />
        </div>
        <div class="form-group">
          <label>{{ t('auth.password') }}</label>
          <div class="pw-field">
            <input
              v-model="password"
              :type="showPw ? 'text' : 'password'"
              class="form-control"
            />
            <button type="button" class="pw-toggle" :aria-label="showPw ? t('auth.hidePassword') : t('auth.showPassword')" @click="showPw = !showPw">
              <i class="bi" :class="showPw ? 'bi-eye-slash' : 'bi-eye'"></i>
            </button>
          </div>
        </div>

        <div class="auth-link-row">
          <router-link to="/forgot-password">{{ t('auth.forgotPassword') }}</router-link>
        </div>

        <p v-if="error" class="form-error"><i class="bi bi-exclamation-circle"></i>{{ error }}</p>

        <button class="btn btn-brand auth-submit" :disabled="auth.loading">
          <span v-if="auth.loading" class="spinner-border spinner-border-sm"></span>
          {{ t('auth.login') }}
        </button>
      </form>

      <p class="auth-foot">
        {{ t('auth.noAccount') }} <router-link to="/register">{{ t('auth.createOne') }}</router-link>
      </p>
    </div>
  </div>
</template>
