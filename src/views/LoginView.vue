<script setup>
/**
 * LoginView — email/password sign-in. Validates client-side, then delegates to
 * the auth store. In demo mode any credentials succeed.
 */
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore.js'
import { isSupabaseConfigured } from '../services/supabaseClient.js'
import { validateEmail, validatePassword, firstError } from '../utils/validation.js'
import logoMark from '../assets/images/logo-mark.png'

const { t } = useI18n()
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
    router.push(route.query.redirect || '/hub')
  } catch (e) {
    error.value = auth.error || 'Login failed.'
  }
}
</script>

<template>
  <div class="auth-wrap">
    <aside class="auth-aside">
      <div class="auth-brand"><img :src="logoMark" alt="StudySync logo" />StudySync</div>
      <h2>{{ t('auth.welcomeBack') }}</h2>
      <p class="auth-aside-sub">{{ t('auth.welcomeSub') }}</p>
      <ul>
        <li><i class="bi bi-check-circle-fill"></i> {{ t('auth.feat1') }}</li>
        <li><i class="bi bi-check-circle-fill"></i> {{ t('auth.feat2') }}</li>
        <li><i class="bi bi-check-circle-fill"></i> {{ t('auth.feat3') }}</li>
      </ul>
    </aside>

    <div class="auth-form-panel">
      <div class="auth-card">
        <h1>{{ t('auth.login') }}</h1>
        <p class="auth-sub">{{ t('auth.loginSub') }}</p>

        <div v-if="!isSupabaseConfigured" class="demo-hint">
          <i class="bi bi-info-circle"></i>
          {{ t('auth.demoLogin') }}
        </div>

        <form @submit.prevent="submit">
          <div class="form-group">
            <label>{{ t('auth.email') }}</label>
            <input v-model="email" type="email" class="form-control" :placeholder="t('auth.emailPlaceholder')" />
          </div>
          <div class="form-group">
            <label>{{ t('auth.password') }}</label>
            <input v-model="password" type="password" class="form-control" placeholder="••••••••" />
          </div>

          <p v-if="error" class="form-error"><i class="bi bi-exclamation-circle"></i>{{ error }}</p>

          <button class="btn btn-brand auth-submit" :disabled="auth.loading">
            <span v-if="auth.loading" class="spinner-border spinner-border-sm"></span>
            {{ t('auth.login') }}
          </button>
        </form>

        <p class="auth-alt">
          {{ t('auth.noAccount') }} <router-link to="/register">{{ t('auth.createOne') }}</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
