<script setup>
/**
 * WelcomeView — the landing page after a user confirms their email. Supabase
 * processes the confirmation token in the URL and creates a session; we refresh
 * the auth store so the "Go to app" button drops straight into the Hub.
 */
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore.js'
import logoMark from '../assets/images/logo-mark.png'

const { t } = useI18n()
const auth = useAuthStore()

onMounted(async () => {
  // Re-read the session the confirmation link just established.
  auth.initialised = false
  await auth.init()
})
</script>

<template>
  <div class="auth-screen">
    <div class="auth-box">
      <div class="auth-logo">
        <img :src="logoMark" alt="StudySync logo" />
        <span>StudySync<small>Vietnam</small></span>
      </div>

      <div class="auth-success">
        <div class="as-icon ok"><i class="bi bi-check2-circle"></i></div>
        <h1>{{ t('auth.welcomeDoneTitle') }}</h1>
        <p>{{ t('auth.welcomeDoneConfirmed') }}</p>
        <p>{{ t('auth.welcomeDoneMessage') }}</p>
        <div class="as-actions">
          <router-link to="/hub" class="btn btn-brand">{{ t('auth.goToApp') }}</router-link>
        </div>
      </div>
    </div>
  </div>
</template>
