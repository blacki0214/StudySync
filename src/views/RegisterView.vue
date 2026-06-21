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
import logoMark from '../assets/images/logo-mark.png'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
    router.push('/hub')
  } catch (e) {
    error.value = auth.error || 'Registration failed.'
  }
}
</script>

<template>
  <div class="auth-wrap">
    <aside class="auth-aside">
      <div class="auth-brand"><img :src="logoMark" alt="StudySync logo" />StudySync</div>
      <h2>{{ t('auth.joinTitle') }}</h2>
      <p class="auth-aside-sub">{{ t('auth.joinSub') }}</p>
      <ul>
        <li><i class="bi bi-check-circle-fill"></i> {{ t('auth.feat1') }}</li>
        <li><i class="bi bi-check-circle-fill"></i> {{ t('auth.feat2') }}</li>
        <li><i class="bi bi-check-circle-fill"></i> {{ t('auth.feat3') }}</li>
      </ul>
    </aside>

    <div class="auth-form-panel">
      <div class="auth-card">
        <h1>{{ t('auth.register') }}</h1>
        <p class="auth-sub">{{ t('auth.registerSub') }}</p>

        <div v-if="!isSupabaseConfigured" class="demo-hint">
          <i class="bi bi-info-circle"></i>
          {{ t('auth.demoRegister') }}
        </div>

        <form @submit.prevent="submit">
          <div class="form-group">
            <label>{{ t('auth.fullName') }}</label>
            <input v-model="fullName" type="text" class="form-control" :placeholder="t('auth.namePlaceholder')" />
          </div>
          <div class="form-group">
            <label>{{ t('auth.email') }}</label>
            <input v-model="email" type="email" class="form-control" :placeholder="t('auth.emailPlaceholder')" />
          </div>
          <div class="form-group">
            <label>{{ t('auth.password') }}</label>
            <input v-model="password" type="password" class="form-control" :placeholder="t('auth.passwordPlaceholder')" />
          </div>

          <p v-if="error" class="form-error"><i class="bi bi-exclamation-circle"></i>{{ error }}</p>

          <button class="btn btn-brand auth-submit" :disabled="auth.loading">
            <span v-if="auth.loading" class="spinner-border spinner-border-sm"></span>
            {{ t('auth.register') }}
          </button>
        </form>

        <p class="auth-alt">
          {{ t('auth.alreadyRegistered') }} <router-link to="/login">{{ t('auth.login') }}</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
