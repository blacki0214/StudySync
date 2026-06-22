<script setup>
/**
 * ResetPasswordView â€” the page the reset email links to. Supabase establishes a
 * short-lived recovery session from the URL automatically; the user just sets a
 * new password here.
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore.js'
import { validatePassword, passwordStrength } from '../utils/validation.js'
import logoMark from '../assets/images/logo_2.png'

const { t } = useI18n()
const auth = useAuthStore()

const password = ref('')
const confirm = ref('')
const showPw = ref(false)
const error = ref(null)
const done = ref(false)

const strength = computed(() => passwordStrength(password.value))
const strengthLabel = computed(() => t('auth.strength' + strength.value.key.charAt(0).toUpperCase() + strength.value.key.slice(1)))

async function submit() {
  error.value = validatePassword(password.value)
  if (error.value) return
  if (password.value !== confirm.value) {
    error.value = t('auth.passwordsMismatch')
    return
  }
  try {
    await auth.updatePassword(password.value)
    done.value = true
  } catch (e) {
    error.value = auth.error || 'Could not update the password.'
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

      <div v-if="done" class="auth-success">
        <div class="as-icon ok"><i class="bi bi-shield-check"></i></div>
        <h1>{{ t('auth.resetDoneTitle') }}</h1>
        <p>{{ t('auth.resetDoneSub') }}</p>
        <div class="as-actions">
          <router-link to="/login" class="btn btn-brand">{{ t('auth.login') }}</router-link>
        </div>
      </div>

      <template v-else>
        <div class="auth-head">
          <h1>{{ t('auth.resetTitle') }}</h1>
          <p>{{ t('auth.resetSub') }}</p>
        </div>
        <form @submit.prevent="submit">
          <div class="form-group">
            <label>{{ t('auth.newPassword') }}</label>
            <div class="pw-field">
              <input v-model="password" :type="showPw ? 'text' : 'password'" class="form-control" :placeholder="t('auth.passwordPlaceholder')" />
              <button type="button" class="pw-toggle" :aria-label="showPw ? t('auth.hidePassword') : t('auth.showPassword')" @click="showPw = !showPw">
                <i class="bi" :class="showPw ? 'bi-eye-slash' : 'bi-eye'"></i>
              </button>
            </div>
            <div v-if="password" class="pw-strength" :class="'lvl-' + strength.score">
              <div class="pw-bars" :class="'s' + strength.score"><span></span><span></span><span></span><span></span></div>
              <span class="pw-label">{{ strengthLabel }}</span>
            </div>
          </div>
          <div class="form-group">
            <label>{{ t('auth.confirmPassword') }}</label>
            <div class="pw-field">
              <input v-model="confirm" :type="showPw ? 'text' : 'password'" class="form-control" :placeholder="t('auth.confirmPasswordPlaceholder')" />
            </div>
          </div>
          <p v-if="error" class="form-error"><i class="bi bi-exclamation-circle"></i>{{ error }}</p>
          <button class="btn btn-brand auth-submit" :disabled="auth.loading">
            <span v-if="auth.loading" class="spinner-border spinner-border-sm"></span>
            {{ t('auth.updatePassword') }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>
