<script setup>
/**
 * SettingsView — a Notion-style settings page with a left section rail and a
 * content panel: Account (profile personalisation), Preferences (theme +
 * language), Notifications, and Password & security. Replaces the old public
 * Profile page (which had little to show since notes are private).
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore.js'
import { useUiStore } from '../stores/uiStore.js'
import { useNotificationStore } from '../stores/notificationStore.js'
import { useDialogStore } from '../stores/dialogStore.js'
import { useTourStore } from '../stores/tourStore.js'
import { SUPPORTED, setLocale } from '../i18n/index.js'
import { resizeImageToDataUrl } from '../utils/image.js'
import AppSelect from '../components/common/AppSelect.vue'

const { t, locale } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()
const notif = useNotificationStore()
const dialog = useDialogStore()
const tour = useTourStore()

const user = computed(() => auth.user || {})
const section = ref('account')
const sections = [
  { key: 'account', group: 'settings.groupAccount', label: 'settings.account', icon: 'bi-person' },
  { key: 'preferences', group: 'settings.groupAccount', label: 'settings.preferences', icon: 'bi-sliders' },
  { key: 'notifications', group: 'settings.groupAccount', label: 'settings.notifications', icon: 'bi-bell' },
  { key: 'security', group: 'settings.groupSecurity', label: 'settings.security', icon: 'bi-shield-lock' }
]
const navGroups = computed(() => {
  const seen = []
  sections.forEach((s) => { if (!seen.find((g) => g.group === s.group)) seen.push({ group: s.group, items: [] }) })
  seen.forEach((g) => { g.items = sections.filter((s) => s.group === g.group) })
  return seen
})

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

// --- Account (profile) ---------------------------------------------------
const bannerColors = ['grad-blue', 'grad-green', 'grad-fuchsia', 'grad-orange']
const saving = ref(false)
const avatarError = ref('')
const form = ref({
  full_name: user.value.full_name || '',
  handle: user.value.handle || '',
  program: user.value.program || '',
  school: user.value.school || '',
  location: user.value.location || '',
  bio: user.value.bio || '',
  avatar_url: user.value.avatar_url || '',
  color: user.value.color || 'grad-blue'
})
async function onAvatar(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  avatarError.value = ''
  if (file.size > 5 * 1024 * 1024) { avatarError.value = t('profile.avatarTooBig'); return }
  try { form.value.avatar_url = await resizeImageToDataUrl(file, 256) }
  catch { avatarError.value = t('profile.avatarFailed') }
}
async function saveAccount() {
  if (!form.value.full_name.trim()) return
  saving.value = true
  try {
    await auth.updateProfile({
      full_name: form.value.full_name.trim(),
      handle: form.value.handle.trim() || null,
      program: form.value.program.trim() || null,
      school: form.value.school.trim() || null,
      location: form.value.location.trim() || null,
      bio: form.value.bio.trim() || null,
      avatar_url: form.value.avatar_url || null,
      color: form.value.color
    })
    dialog.toast(t('profile.saved'), 'success')
  } catch (e) {
    dialog.toast(/duplicate|unique/i.test(e.message || '') ? t('profile.handleTaken') : t('profile.saveFailed'), 'error')
  } finally {
    saving.value = false
  }
}

// --- Preferences ---------------------------------------------------------
const langOptions = computed(() => SUPPORTED.map((l) => ({ value: l.code, label: l.label })))

// --- Notifications -------------------------------------------------------
function setNotif(key, val) { notif.setPref(key, val) }

// --- Security ------------------------------------------------------------
const pw = ref({ next: '', confirm: '' })
const changingPw = ref(false)
async function changePassword() {
  if (pw.value.next.length < 6) { dialog.toast(t('settings.pwTooShort'), 'warning'); return }
  if (pw.value.next !== pw.value.confirm) { dialog.toast(t('settings.pwMismatch'), 'warning'); return }
  changingPw.value = true
  try {
    await auth.updatePassword(pw.value.next)
    pw.value = { next: '', confirm: '' }
    dialog.toast(t('settings.pwChanged'), 'success')
  } catch {
    dialog.toast(t('settings.pwFailed'), 'error')
  } finally {
    changingPw.value = false
  }
}
async function signOut() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="settings-layout">
    <!-- Section rail -->
    <aside class="settings-nav">
      <div v-for="g in navGroups" :key="g.group" class="settings-nav-group">
        <div class="settings-nav-label">{{ t(g.group) }}</div>
        <button
          v-for="s in g.items"
          :key="s.key"
          class="settings-nav-item"
          :class="{ active: section === s.key }"
          @click="section = s.key"
        >
          <i class="bi" :class="s.icon"></i>{{ t(s.label) }}
        </button>
      </div>
    </aside>

    <!-- Content -->
    <section class="settings-content">
      <!-- ACCOUNT -->
      <div v-if="section === 'account'">
        <h1 class="settings-h1">{{ t('settings.account') }}</h1>
        <p class="settings-sub">{{ t('settings.accountSub') }}</p>

        <div class="settings-block">
          <div class="sb-title">{{ t('settings.profile') }}</div>
          <div class="acct-banner" :class="form.color">
            <span class="acct-avatar-wrap">
              <img v-if="form.avatar_url" :src="form.avatar_url" class="acct-avatar" alt="" />
              <span v-else class="acct-avatar acct-avatar-fallback">{{ initials(form.full_name) }}</span>
            </span>
            <div class="acct-avatar-actions">
              <label class="btn btn-soft btn-sm"><i class="bi bi-upload"></i>{{ t('profile.uploadAvatar') }}<input type="file" accept="image/*" hidden @change="onAvatar" /></label>
              <button v-if="form.avatar_url" class="btn btn-soft btn-sm" @click="form.avatar_url = ''"><i class="bi bi-x-lg"></i>{{ t('profile.removeAvatar') }}</button>
            </div>
          </div>
          <p v-if="avatarError" class="field-error">{{ avatarError }}</p>

          <div class="settings-field">
            <label>{{ t('profile.bannerColour') }}</label>
            <div class="set-swatches">
              <button v-for="c in bannerColors" :key="c" type="button" class="set-swatch icon-tile" :class="[c, { active: form.color === c }]" @click="form.color = c"><i v-if="form.color === c" class="bi bi-check-lg"></i></button>
            </div>
          </div>

          <div class="settings-field"><label>{{ t('profile.fullName') }}</label><input v-model="form.full_name" class="form-control" /></div>
          <div class="set-grid">
            <div class="settings-field"><label>{{ t('profile.handle') }}</label><input v-model="form.handle" class="form-control" placeholder="username" /></div>
            <div class="settings-field"><label>{{ t('profile.program') }}</label><input v-model="form.program" class="form-control" :placeholder="t('profile.programPlaceholder')" /></div>
            <div class="settings-field"><label>{{ t('profile.school') }}</label><input v-model="form.school" class="form-control" :placeholder="t('profile.schoolPlaceholder')" /></div>
            <div class="settings-field"><label>{{ t('profile.location') }}</label><input v-model="form.location" class="form-control" :placeholder="t('profile.locationPlaceholder')" /></div>
          </div>
          <div class="settings-field"><label>{{ t('profile.about') }}</label><textarea v-model="form.bio" class="form-control" rows="3" :placeholder="t('profile.bioPlaceholder')"></textarea></div>
          <div class="settings-field"><label>{{ t('settings.email') }}</label><input class="form-control" :value="user.email || '—'" readonly /></div>

          <div class="settings-actions">
            <button class="btn btn-brand" :disabled="saving || !form.full_name.trim()" @click="saveAccount">
              <span v-if="saving" class="spinner-border spinner-border-sm"></span>{{ t('profile.save') }}
            </button>
          </div>
        </div>
      </div>

      <!-- PREFERENCES -->
      <div v-else-if="section === 'preferences'">
        <h1 class="settings-h1">{{ t('settings.preferences') }}</h1>
        <p class="settings-sub">{{ t('settings.preferencesSub') }}</p>

        <div class="settings-block">
          <div class="settings-row">
            <div class="sr-text"><div class="sr-label">{{ t('settings.darkMode') }}</div><div class="sr-hint">{{ t('settings.darkModeHint') }}</div></div>
            <button class="switch" :class="{ on: ui.isDark }" role="switch" :aria-checked="ui.isDark" @click="ui.toggleTheme()"><span class="switch-knob"></span></button>
          </div>
          <div class="settings-row">
            <div class="sr-text"><div class="sr-label">{{ t('settings.language') }}</div><div class="sr-hint">{{ t('settings.languageHint') }}</div></div>
            <AppSelect class="set-lang" :model-value="locale" :options="langOptions" @update:model-value="setLocale" />
          </div>
        </div>

        <!-- Onboarding: the same actions as the floating "?" menu, for users
             who look for them in Settings instead. -->
        <div class="settings-block">
          <div class="sb-title">{{ t('settings.guidance') }}</div>
          <div class="settings-row">
            <div class="sr-text"><div class="sr-label">{{ t('help.menuTour') }}</div><div class="sr-hint">{{ t('help.menuTourHint') }}</div></div>
            <button class="btn btn-outline-soft btn-sm" @click="tour.startTour()"><i class="bi bi-play-circle"></i>{{ t('settings.replay') }}</button>
          </div>
          <div class="settings-row">
            <div class="sr-text"><div class="sr-label">{{ t('help.menuChecklist') }}</div><div class="sr-hint">{{ t('help.menuChecklistHint') }}</div></div>
            <button class="btn btn-outline-soft btn-sm" :disabled="!tour.checklistDismissed" @click="tour.showChecklist()">
              <i class="bi bi-eye"></i>{{ tour.checklistDismissed ? t('settings.showIt') : t('settings.shown') }}
            </button>
          </div>
          <div class="settings-row">
            <div class="sr-text"><div class="sr-label">{{ t('help.title') }}</div><div class="sr-hint">{{ t('help.subtitle') }}</div></div>
            <button class="btn btn-outline-soft btn-sm" @click="tour.openHelp('faq')"><i class="bi bi-question-circle"></i>{{ t('settings.openHelp') }}</button>
          </div>
        </div>
      </div>

      <!-- NOTIFICATIONS -->
      <div v-else-if="section === 'notifications'">
        <h1 class="settings-h1">{{ t('settings.notifications') }}</h1>
        <p class="settings-sub">{{ t('settings.notificationsSub') }}</p>

        <div class="settings-block">
          <div class="settings-row">
            <div class="sr-text"><div class="sr-label">{{ t('settings.notifDeadlines') }}</div><div class="sr-hint">{{ t('settings.notifDeadlinesHint') }}</div></div>
            <button class="switch" :class="{ on: notif.prefs.deadlines }" role="switch" :aria-checked="notif.prefs.deadlines" @click="setNotif('deadlines', !notif.prefs.deadlines)"><span class="switch-knob"></span></button>
          </div>
          <div class="settings-row">
            <div class="sr-text"><div class="sr-label">{{ t('settings.notifActivity') }}</div><div class="sr-hint">{{ t('settings.notifActivityHint') }}</div></div>
            <button class="switch" :class="{ on: notif.prefs.activity }" role="switch" :aria-checked="notif.prefs.activity" @click="setNotif('activity', !notif.prefs.activity)"><span class="switch-knob"></span></button>
          </div>
        </div>
      </div>

      <!-- SECURITY -->
      <div v-else>
        <h1 class="settings-h1">{{ t('settings.security') }}</h1>
        <p class="settings-sub">{{ t('settings.securitySub') }}</p>

        <div class="settings-block">
          <div class="sb-title">{{ t('settings.email') }}</div>
          <div class="settings-field"><input class="form-control" :value="user.email || '—'" readonly /></div>
        </div>

        <div class="settings-block">
          <div class="sb-title">{{ t('settings.changePassword') }}</div>
          <div class="set-grid">
            <div class="settings-field"><label>{{ t('settings.newPassword') }}</label><input v-model="pw.next" type="password" class="form-control" autocomplete="new-password" /></div>
            <div class="settings-field"><label>{{ t('settings.confirmPassword') }}</label><input v-model="pw.confirm" type="password" class="form-control" autocomplete="new-password" /></div>
          </div>
          <div class="settings-actions">
            <button class="btn btn-brand" :disabled="changingPw || !pw.next || !pw.confirm" @click="changePassword">
              <span v-if="changingPw" class="spinner-border spinner-border-sm"></span>{{ t('settings.updatePassword') }}
            </button>
          </div>
        </div>

        <div class="settings-block">
          <div class="sb-title">{{ t('settings.session') }}</div>
          <button class="btn btn-danger-soft" @click="signOut"><i class="bi bi-box-arrow-right"></i>{{ t('nav.logout') }}</button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-layout { display: grid; grid-template-columns: 220px 1fr; gap: var(--space-5); align-items: start; }
.settings-nav { position: sticky; top: var(--space-4); display: flex; flex-direction: column; gap: var(--space-4); }
.settings-nav-group { display: flex; flex-direction: column; gap: 0.15rem; }
.settings-nav-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: .04em; color: var(--c-text-faint); padding: 0 0.6rem 0.25rem; font-weight: 700; }
.settings-nav-item {
  display: flex; align-items: center; gap: 0.6rem; text-align: left;
  padding: 0.45rem 0.6rem; border-radius: 8px; border: none; background: none;
  color: var(--c-text-muted); font-size: 0.9rem; font-weight: 600; cursor: pointer;
}
.settings-nav-item:hover { background: var(--c-surface-2); color: var(--c-text); }
.settings-nav-item.active { background: var(--c-primary-light); color: var(--c-primary-dark); }

.settings-content { min-width: 0; max-width: 720px; }
.settings-h1 { font-size: 1.5rem; font-weight: 800; margin: 0; }
.settings-sub { color: var(--c-text-muted); margin: 0.15rem 0 var(--space-5); }
.settings-block {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--radius); padding: var(--space-4); margin-bottom: var(--space-4);
}
.sb-title { font-weight: 700; margin-bottom: var(--space-3); }
.settings-field { margin-bottom: var(--space-3); }
.settings-field label { display: block; font-size: 0.82rem; color: var(--c-text-muted); margin-bottom: 0.3rem; }
.set-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.settings-actions { display: flex; justify-content: flex-end; margin-top: var(--space-2); }
.settings-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); padding: var(--space-2) 0; }
.settings-row + .settings-row { border-top: 1px solid var(--c-border); }
.sr-label { font-weight: 600; }
.sr-hint { color: var(--c-text-muted); font-size: 0.82rem; margin-top: 0.1rem; }
.set-lang { min-width: 150px; }

.acct-banner { position: relative; height: 84px; border-radius: var(--radius); margin-bottom: 44px; }
.acct-avatar-wrap { position: absolute; left: var(--space-3); bottom: -32px; line-height: 0; }
.acct-avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 4px solid var(--c-surface); background: var(--c-surface-2); display: block; }
.acct-avatar-fallback { display: grid; place-items: center; background: var(--grad-brand); color: #fff; font-size: 1.4rem; font-weight: 700; }
.acct-avatar-actions { position: absolute; right: var(--space-3); bottom: -36px; display: flex; gap: var(--space-2); }
.set-swatches { display: flex; gap: var(--space-2); }
.set-swatch { width: 36px; height: 36px; border-radius: 9px; cursor: pointer; display: grid; place-items: center; color: #fff; border: 2px solid transparent; }
.set-swatch.active { border-color: var(--c-text); }
.field-error { color: var(--c-danger, #ef4444); font-size: 0.8rem; margin: 0 0 var(--space-2); }

@media (max-width: 760px) {
  .settings-layout { grid-template-columns: 1fr; }
  .settings-nav { position: static; flex-direction: row; flex-wrap: wrap; }
  .set-grid { grid-template-columns: 1fr; }
}
</style>
