<script setup>
/**
 * ForgotPasswordView â€” request a password-reset email. On success we show a
 * neutral "check your email" message (we don't reveal whether the email exists).
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore.js'
import { validateEmail } from '../utils/validation.js'
import logoMark from '../assets/images/logo_2.png'

const { t } = useI18n()
const auth = useAuthStore()

const email = ref('')
const error = ref(null)
const sent = ref(false)

async function submit() {
  error.value = validateEmail(email.value)
  if (error.value) return
  try {
    await auth.requestPasswordReset(email.value)
    sent.value = true
  } catch (e) {
    error.value = auth.error || 'Could not send the reset email.'
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

      <div v-if="sent" class="auth-success">
        <div class="as-icon"><i class="bi bi-envelope-paper"></i></div>
        <h1>{{ t('auth.resetSentTitle') }}</h1>
        <p>{{ t('auth.resetSentSub', { email }) }}</p>
        <div class="as-actions">
          <router-link to="/login" class="btn btn-brand">{{ t('auth.backToLogin') }}</router-link>
        </div>
      </div>

      <template v-else>
        <div class="auth-head">
          <h1>{{ t('auth.forgotTitle') }}</h1>
          <p>{{ t('auth.forgotSub') }}</p>
        </div>
        <form @submit.prevent="submit">
          <div class="form-group">
            <label>{{ t('auth.email') }}</label>
            <input v-model="email" type="email" class="form-control" :placeholder="t('auth.emailPlaceholder')" />
          </div>
          <p v-if="error" class="form-error"><i class="bi bi-exclamation-circle"></i>{{ error }}</p>
          <button class="btn btn-brand auth-submit" :disabled="auth.loading">
            <span v-if="auth.loading" class="spinner-border spinner-border-sm"></span>
            {{ t('auth.sendResetLink') }}
          </button>
        </form>
        <p class="auth-foot">
          <router-link to="/login">{{ t('auth.backToLogin') }}</router-link>
        </p>
      </template>
    </div>
  </div>
</template>
