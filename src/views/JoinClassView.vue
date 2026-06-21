<script setup>
/**
 * JoinClassView — enter a class join code to enroll. Supports a prefilled
 * ?code= deep link (shareable invite). On success, opens the class.
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useClassStore } from '../stores/classStore.js'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const classStore = useClassStore()

const code = ref('')
const error = ref('')
const joining = ref(false)

onMounted(() => {
  if (route.query.code) code.value = String(route.query.code).toUpperCase()
})

async function join() {
  error.value = ''
  if (!code.value.trim()) return
  joining.value = true
  try {
    const cls = await classStore.joinByCode(code.value.trim().toUpperCase())
    router.push({ name: 'class-detail', params: { id: cls.id } })
  } catch (e) {
    error.value =
      e.code === 'not_found' ? t('classes.codeNotFound')
      : e.code === 'already_member' ? t('classes.alreadyMember')
      : (e.message || t('classes.joinFailed'))
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <div class="join-wrap">
    <div class="panel join-card">
      <div class="join-icon"><i class="bi bi-box-arrow-in-right"></i></div>
      <h1>{{ t('classes.joinTitle') }}</h1>
      <p class="join-sub">{{ t('classes.joinSub') }}</p>

      <input
        v-model="code"
        class="form-control join-code-input"
        :placeholder="t('classes.codePlaceholder')"
        maxlength="8"
        @keyup.enter="join"
      />
      <p v-if="error" class="form-error"><i class="bi bi-exclamation-circle"></i>{{ error }}</p>

      <button class="btn btn-brand w-100" :disabled="joining || !code.trim()" @click="join">
        <span v-if="joining" class="spinner-border spinner-border-sm"></span>{{ t('classes.joinAction') }}
      </button>
      <router-link to="/classes" class="join-back">{{ t('classes.backToClasses') }}</router-link>
    </div>
  </div>
</template>
