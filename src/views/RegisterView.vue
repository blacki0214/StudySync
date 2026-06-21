<script setup>
/**
 * RegisterView — a multi-step signup wizard (name → details → role → purpose →
 * account), then an email-confirmation screen. Centered single-column layout.
 * All data is persisted via authService (Supabase, or localStorage in demo mode).
 */
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore.js'
import { isSupabaseConfigured } from '../services/supabaseClient.js'
import { validateEmail, validatePassword, validatePhone, passwordStrength } from '../utils/validation.js'
import AppSelect from '../components/common/AppSelect.vue'
import logoMark from '../assets/images/logo-mark.png'

const { t, locale } = useI18n()
const auth = useAuthStore()
const router = useRouter()

const TOTAL = 5
const step = ref(0)
const mode = ref('form') // 'form' | 'sent'
const error = ref(null)
const showPw = ref(false)

const form = ref({
  firstName: '',
  lastName: '',
  dob: '',
  phone: '',
  role: '',
  purpose: '',
  email: '',
  password: '',
  confirm: ''
})

// Date of birth via three themed dropdowns (no OS calendar).
const dobDay = ref('')
const dobMonth = ref('')
const dobYear = ref('')
const thisYear = new Date().getFullYear()

const daysInSelected = computed(() => {
  const y = Number(dobYear.value) || 2000
  const m = Number(dobMonth.value)
  return m ? new Date(y, m, 0).getDate() : 31
})
const dayOptions = computed(() =>
  Array.from({ length: daysInSelected.value }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))
)
const monthOptions = computed(() =>
  Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2000, i, 1).toLocaleDateString(locale.value === 'vi' ? 'vi-VN' : 'en-US', { month: 'long' })
  }))
)
const yearOptions = Array.from({ length: 96 }, (_, i) => {
  const y = thisYear - 5 - i // sensible DOB range: 5–100 years ago
  return { value: String(y), label: String(y) }
})

// Compose the stored 'YYYY-MM-DD' whenever a part changes; clamp invalid days.
watch([dobDay, dobMonth, dobYear], () => {
  if (Number(dobDay.value) > daysInSelected.value) dobDay.value = String(daysInSelected.value)
  form.value.dob =
    dobDay.value && dobMonth.value && dobYear.value
      ? `${dobYear.value}-${String(dobMonth.value).padStart(2, '0')}-${String(dobDay.value).padStart(2, '0')}`
      : ''
})

const roles = [
  { value: 'student', icon: 'bi-mortarboard-fill', grad: 'grad-blue', title: 'auth.roleStudent', desc: 'auth.roleStudentDesc' },
  { value: 'teacher', icon: 'bi-easel2-fill', grad: 'grad-green', title: 'auth.roleTeacher', desc: 'auth.roleTeacherDesc' }
]
const purposes = [
  { value: 'personal', icon: 'bi-person-fill', grad: 'grad-fuchsia', title: 'auth.purposePersonal', desc: 'auth.purposePersonalDesc' },
  { value: 'education', icon: 'bi-book-fill', grad: 'grad-blue', title: 'auth.purposeEducation', desc: 'auth.purposeEducationDesc' },
  { value: 'teaching', icon: 'bi-easel-fill', grad: 'grad-orange', title: 'auth.purposeTeaching', desc: 'auth.purposeTeachingDesc' }
]

// Password strength (for the meter on the account step).
const strength = computed(() => passwordStrength(form.value.password))
const strengthLabel = computed(() => t('auth.strength' + strength.value.key.charAt(0).toUpperCase() + strength.value.key.slice(1)))

/** Validate the current step; returns an error string or null. */
function validateStep() {
  const f = form.value
  switch (step.value) {
    case 0:
      if (!f.firstName.trim() || !f.lastName.trim()) return t('auth.selectRequired')
      return null
    case 1: {
      if (!f.dob) return t('auth.selectRequired')
      const phoneErr = validatePhone(f.phone)
      return phoneErr // English message from validator
    }
    case 2:
      return f.role ? null : t('auth.selectRequired')
    case 3:
      return f.purpose ? null : t('auth.selectRequired')
    case 4: {
      const e = validateEmail(f.email) || validatePassword(f.password)
      if (e) return e
      if (f.password !== f.confirm) return t('auth.passwordsMismatch')
      return null
    }
  }
  return null
}

function next() {
  error.value = validateStep()
  if (error.value) return
  if (step.value < TOTAL - 1) step.value++
  else submit()
}
function back() {
  error.value = null
  if (step.value > 0) step.value--
}
function pick(field, value) {
  form.value[field] = value
  error.value = null
}

async function submit() {
  error.value = null
  try {
    const result = await auth.register({ ...form.value })
    if (result.needsConfirmation) {
      mode.value = 'sent'
    } else {
      router.push('/welcome')
    }
  } catch (e) {
    error.value = e.code === 'email_exists' ? t('auth.emailExists') : (auth.error || 'Registration failed.')
    // Jump back to the account step so they can fix the email.
    if (e.code === 'email_exists') step.value = 4
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

      <!-- Email confirmation sent -->
      <div v-if="mode === 'sent'" class="auth-success">
        <div class="as-icon"><i class="bi bi-envelope-paper"></i></div>
        <h1>{{ t('auth.checkEmailTitle') }}</h1>
        <p>{{ t('auth.checkEmailSub', { email: form.email }) }}</p>
        <p class="text-muted-sm">{{ t('auth.checkEmailHint') }}</p>
        <div class="as-actions">
          <router-link to="/login" class="btn btn-brand">{{ t('auth.backToLogin') }}</router-link>
        </div>
      </div>

      <!-- The wizard -->
      <template v-else>
        <div class="auth-progress">
          <span v-for="i in TOTAL" :key="i" class="seg" :class="{ done: i - 1 <= step }"></span>
        </div>
        <div class="auth-step-count">{{ t('auth.step', { n: step + 1, total: TOTAL }) }}</div>

        <div v-if="!isSupabaseConfigured" class="demo-hint">
          <i class="bi bi-info-circle"></i> {{ t('auth.demoRegister') }}
        </div>

        <!-- Step 1: name -->
        <div v-if="step === 0">
          <div class="auth-head">
            <h1>{{ t('auth.stepNameTitle') }}</h1>
            <p>{{ t('auth.stepNameSub') }}</p>
          </div>
          <div class="field-row">
            <div class="form-group">
              <label>{{ t('auth.firstName') }}</label>
              <input v-model="form.firstName" class="form-control" :placeholder="t('auth.firstNamePlaceholder')" @keyup.enter="next" />
            </div>
            <div class="form-group">
              <label>{{ t('auth.lastName') }}</label>
              <input v-model="form.lastName" class="form-control" :placeholder="t('auth.lastNamePlaceholder')" @keyup.enter="next" />
            </div>
          </div>
        </div>

        <!-- Step 2: details -->
        <div v-else-if="step === 1">
          <div class="auth-head">
            <h1>{{ t('auth.stepDetailsTitle') }}</h1>
            <p>{{ t('auth.stepDetailsSub') }}</p>
          </div>
          <div class="form-group">
            <label>{{ t('auth.dob') }}</label>
            <div class="dob-grid">
              <AppSelect v-model="dobDay" :options="dayOptions" placeholder="" :aria-label="t('auth.day')" />
              <AppSelect v-model="dobMonth" :options="monthOptions" placeholder="" :aria-label="t('auth.month')" />
              <AppSelect v-model="dobYear" :options="yearOptions" placeholder="" :aria-label="t('auth.year')" />
            </div>
          </div>
          <div class="form-group">
            <label>{{ t('auth.phone') }}</label>
            <input v-model="form.phone" type="tel" class="form-control" :placeholder="t('auth.phonePlaceholder')" @keyup.enter="next" />
          </div>
        </div>

        <!-- Step 3: role -->
        <div v-else-if="step === 2">
          <div class="auth-head">
            <h1>{{ t('auth.stepRoleTitle') }}</h1>
            <p>{{ t('auth.stepRoleSub') }}</p>
          </div>
          <div class="choice-list">
            <button
              v-for="r in roles"
              :key="r.value"
              type="button"
              class="choice-card"
              :class="{ selected: form.role === r.value }"
              @click="pick('role', r.value)"
            >
              <span class="choice-icon" :class="r.grad"><i class="bi" :class="r.icon"></i></span>
              <span class="choice-text">
                <span class="choice-title">{{ t(r.title) }}</span>
                <span class="choice-desc">{{ t(r.desc) }}</span>
              </span>
              <i class="bi bi-check-circle-fill choice-check"></i>
            </button>
          </div>
        </div>

        <!-- Step 4: purpose -->
        <div v-else-if="step === 3">
          <div class="auth-head">
            <h1>{{ t('auth.stepPurposeTitle') }}</h1>
            <p>{{ t('auth.stepPurposeSub') }}</p>
          </div>
          <div class="choice-list">
            <button
              v-for="p in purposes"
              :key="p.value"
              type="button"
              class="choice-card"
              :class="{ selected: form.purpose === p.value }"
              @click="pick('purpose', p.value)"
            >
              <span class="choice-icon" :class="p.grad"><i class="bi" :class="p.icon"></i></span>
              <span class="choice-text">
                <span class="choice-title">{{ t(p.title) }}</span>
                <span class="choice-desc">{{ t(p.desc) }}</span>
              </span>
              <i class="bi bi-check-circle-fill choice-check"></i>
            </button>
          </div>
        </div>

        <!-- Step 5: account -->
        <div v-else>
          <div class="auth-head">
            <h1>{{ t('auth.stepAccountTitle') }}</h1>
            <p>{{ t('auth.stepAccountSub') }}</p>
          </div>
          <div class="form-group">
            <label>{{ t('auth.email') }}</label>
            <input v-model="form.email" type="email" class="form-control" :placeholder="t('auth.emailPlaceholder')" />
          </div>
          <div class="form-group">
            <label>{{ t('auth.password') }}</label>
            <div class="pw-field">
              <input
                v-model="form.password"
                :type="showPw ? 'text' : 'password'"
                class="form-control"
                :placeholder="t('auth.passwordPlaceholder')"
              />
              <button type="button" class="pw-toggle" :aria-label="showPw ? t('auth.hidePassword') : t('auth.showPassword')" @click="showPw = !showPw">
                <i class="bi" :class="showPw ? 'bi-eye-slash' : 'bi-eye'"></i>
              </button>
            </div>
            <div v-if="form.password" class="pw-strength" :class="'lvl-' + strength.score">
              <div class="pw-bars" :class="'s' + strength.score"><span></span><span></span><span></span><span></span></div>
              <span class="pw-label">{{ strengthLabel }}</span>
            </div>
          </div>
          <div class="form-group">
            <label>{{ t('auth.confirmPassword') }}</label>
            <div class="pw-field">
              <input
                v-model="form.confirm"
                :type="showPw ? 'text' : 'password'"
                class="form-control"
                :placeholder="t('auth.confirmPasswordPlaceholder')"
                @keyup.enter="next"
              />
            </div>
          </div>
        </div>

        <p v-if="error" class="form-error"><i class="bi bi-exclamation-circle"></i>{{ error }}</p>

        <div class="auth-actions">
          <button v-if="step > 0" type="button" class="btn btn-outline-soft btn-back" @click="back">
            <i class="bi bi-arrow-left"></i>{{ t('auth.back') }}
          </button>
          <button type="button" class="btn btn-brand" :disabled="auth.loading" @click="next">
            <span v-if="auth.loading" class="spinner-border spinner-border-sm"></span>
            {{ step === TOTAL - 1 ? t('auth.finish') : t('auth.next') }}
          </button>
        </div>

        <p class="auth-foot">
          {{ t('auth.alreadyRegistered') }} <router-link to="/login">{{ t('auth.login') }}</router-link>
        </p>
      </template>
    </div>
  </div>
</template>
