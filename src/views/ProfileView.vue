<script setup>
/**
 * ProfileView — a personalisable student profile: a coloured cover banner, an
 * avatar (uploadable), an "About" bio and identity details, plus personal study
 * stats and achievements. "Edit profile" opens a modal that saves through
 * authStore.updateProfile (Supabase or demo/localStorage).
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore.js'
import { useContentStore } from '../stores/contentStore.js'
import { useClassStore } from '../stores/classStore.js'
import { useDialogStore } from '../stores/dialogStore.js'
import { resizeImageToDataUrl } from '../utils/image.js'
import StatCard from '../components/common/StatCard.vue'

const auth = useAuthStore()
const content = useContentStore()
const classStore = useClassStore()
const dialog = useDialogStore()
const { t } = useI18n()
const user = computed(() => auth.user || {})

onMounted(() => {
  content.ensureLoaded()
  classStore.fetchAll()
})

const myNotesCount = computed(() => content.notes.filter((n) => n.author_id === user.value.id).length)
const mySubjectsCount = computed(() => content.subjects.filter((s) => s.owner_id && s.owner_id === user.value.id).length)
const myClassesCount = computed(() => classStore.owned.length + classStore.enrolled.length)

const stats = computed(() => [
  { label: t('profile.notesContributed'), value: myNotesCount.value, icon: 'bi-file-earmark-text', grad: 'grad-blue' },
  { label: t('profile.subjects'), value: mySubjectsCount.value, icon: 'bi-folder', grad: 'grad-fuchsia' },
  { label: t('profile.classes'), value: myClassesCount.value, icon: 'bi-easel2', grad: 'grad-orange' },
  { label: t('profile.streak'), value: (user.value.streak || 0) + 'd', icon: 'bi-fire', grad: 'grad-green' }
])

const achievements = computed(() => content.achievements)
const unlockedCount = computed(() => achievements.value.filter((a) => a.unlocked).length)
const joinedDate = computed(() => {
  const d = user.value.joined || user.value.created_at
  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''
})
function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

// --- Edit profile ---------------------------------------------------------
const bannerColors = ['grad-blue', 'grad-green', 'grad-fuchsia', 'grad-orange']
const showEdit = ref(false)
const saving = ref(false)
const avatarError = ref('')
const form = ref({})

function openEdit() {
  form.value = {
    full_name: user.value.full_name || '',
    handle: user.value.handle || '',
    program: user.value.program || '',
    school: user.value.school || '',
    location: user.value.location || '',
    bio: user.value.bio || '',
    avatar_url: user.value.avatar_url || '',
    color: user.value.color || 'grad-blue'
  }
  avatarError.value = ''
  showEdit.value = true
}
async function onAvatar(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  avatarError.value = ''
  if (file.size > 5 * 1024 * 1024) { avatarError.value = t('profile.avatarTooBig'); return }
  try { form.value.avatar_url = await resizeImageToDataUrl(file, 256) }
  catch { avatarError.value = t('profile.avatarFailed') }
}
async function save() {
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
    showEdit.value = false
    dialog.toast(t('profile.saved'), 'success')
  } catch (e) {
    // A duplicate @handle is the most likely failure.
    dialog.toast(/duplicate|unique/i.test(e.message || '') ? t('profile.handleTaken') : t('profile.saveFailed'), 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <!-- Cover + identity -->
    <div class="profile-header">
      <div class="profile-cover" :class="user.color"></div>
      <div class="profile-id">
        <span class="pi-avatar-wrap">
          <img v-if="user.avatar_url" :src="user.avatar_url" class="pi-avatar" :alt="user.full_name" />
          <span v-else class="pi-avatar pi-avatar-fallback">{{ initials(user.full_name) }}</span>
        </span>
        <div class="pi-main">
          <h1 class="pi-name">{{ user.full_name }}</h1>
          <div v-if="user.handle || user.program" class="pi-handle">
            <template v-if="user.handle">@{{ user.handle }}</template>
            <template v-if="user.handle && user.program"> · </template>
            <template v-if="user.program">{{ user.program }}</template>
          </div>
          <div class="pi-meta">
            <span v-if="user.school"><i class="bi bi-building"></i>{{ user.school }}</span>
            <span v-if="user.location"><i class="bi bi-geo-alt"></i>{{ user.location }}</span>
            <span v-if="joinedDate"><i class="bi bi-calendar3"></i>{{ t('profile.joined', { date: joinedDate }) }}</span>
            <span v-if="user.role"><i class="bi bi-mortarboard"></i>{{ user.role === 'teacher' ? t('auth.roleTeacher') : t('auth.roleStudent') }}</span>
          </div>
        </div>
        <div class="pi-actions">
          <button class="btn btn-brand" @click="openEdit"><i class="bi bi-pencil-square"></i>{{ t('profile.edit') }}</button>
        </div>
      </div>
    </div>

    <!-- About -->
    <div v-if="user.bio" class="panel profile-about">
      <div class="section-title section-title-flush"><i class="bi bi-person-lines-fill"></i>{{ t('profile.about') }}</div>
      <p class="profile-bio">{{ user.bio }}</p>
    </div>

    <!-- Personal stats -->
    <div class="row g-3 row-gap-section">
      <div v-for="s in stats" :key="s.label" class="col-6 col-xl-3"><StatCard v-bind="s" /></div>
    </div>

    <!-- Achievements -->
    <div v-if="achievements.length" class="panel">
      <div class="chart-card-head">
        <div class="section-title section-title-flush"><i class="bi bi-award"></i>{{ t('profile.achievements') }}</div>
        <span class="ach-count">{{ t('profile.unlockedOf', { n: unlockedCount, total: achievements.length }) }}</span>
      </div>
      <div class="row g-3 ach-grid">
        <div v-for="a in achievements" :key="a.id" class="col-6 col-md-4 col-xl-3">
          <div class="ach-card" :class="{ locked: !a.unlocked }">
            <span class="ach-icon" :class="a.color"><i class="bi" :class="a.icon"></i></span>
            <div class="ach-name">{{ a.name }}</div>
            <div class="ach-desc">{{ a.desc }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit profile modal -->
    <div v-if="showEdit" class="modal d-block" tabindex="-1" style="background: rgba(15,23,42,.5)" @click.self="showEdit = false">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ t('profile.editTitle') }}</h5>
            <button class="btn-close" @click="showEdit = false"></button>
          </div>
          <div class="modal-body profile-edit-body">
            <!-- Banner + avatar preview -->
            <div class="pe-preview" :class="form.color">
              <span class="pe-avatar-wrap">
                <img v-if="form.avatar_url" :src="form.avatar_url" class="pe-avatar" alt="" />
                <span v-else class="pe-avatar pe-avatar-fallback">{{ initials(form.full_name) }}</span>
              </span>
              <div class="pe-avatar-actions">
                <label class="btn btn-soft btn-sm"><i class="bi bi-upload"></i>{{ t('profile.uploadAvatar') }}<input type="file" accept="image/*" hidden @change="onAvatar" /></label>
                <button v-if="form.avatar_url" class="btn btn-soft btn-sm" @click="form.avatar_url = ''"><i class="bi bi-x-lg"></i>{{ t('profile.removeAvatar') }}</button>
              </div>
            </div>
            <p v-if="avatarError" class="field-error">{{ avatarError }}</p>

            <div class="form-group">
              <label>{{ t('profile.bannerColour') }}</label>
              <div class="pe-swatches">
                <button
                  v-for="c in bannerColors"
                  :key="c"
                  type="button"
                  class="pe-swatch icon-tile"
                  :class="[c, { active: form.color === c }]"
                  :aria-label="c"
                  @click="form.color = c"
                ><i v-if="form.color === c" class="bi bi-check-lg"></i></button>
              </div>
            </div>

            <div class="form-group">
              <label>{{ t('profile.fullName') }}</label>
              <input v-model="form.full_name" class="form-control" :placeholder="t('profile.fullName')" />
            </div>
            <div class="pe-grid">
              <div class="form-group">
                <label>{{ t('profile.handle') }}</label>
                <input v-model="form.handle" class="form-control" placeholder="username" />
              </div>
              <div class="form-group">
                <label>{{ t('profile.program') }}</label>
                <input v-model="form.program" class="form-control" :placeholder="t('profile.programPlaceholder')" />
              </div>
              <div class="form-group">
                <label>{{ t('profile.school') }}</label>
                <input v-model="form.school" class="form-control" :placeholder="t('profile.schoolPlaceholder')" />
              </div>
              <div class="form-group">
                <label>{{ t('profile.location') }}</label>
                <input v-model="form.location" class="form-control" :placeholder="t('profile.locationPlaceholder')" />
              </div>
            </div>
            <div class="form-group">
              <label>{{ t('profile.about') }}</label>
              <textarea v-model="form.bio" class="form-control" rows="3" :placeholder="t('profile.bioPlaceholder')"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-soft" @click="showEdit = false">{{ t('common.cancel') }}</button>
            <button class="btn btn-brand" :disabled="saving || !form.full_name.trim()" @click="save">
              <span v-if="saving" class="spinner-border spinner-border-sm"></span>{{ t('profile.save') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-about { margin-bottom: var(--space-5); }
.profile-bio { margin: 0; color: var(--c-text); line-height: 1.6; white-space: pre-wrap; }

.profile-edit-body { max-height: 70vh; overflow-y: auto; }
.pe-preview {
  border-radius: var(--radius); height: 96px; margin-bottom: 48px; position: relative;
}
.pe-avatar-wrap { position: absolute; left: var(--space-4); bottom: -36px; line-height: 0; }
.pe-avatar {
  width: 80px; height: 80px; border-radius: 50%; object-fit: cover;
  border: 4px solid var(--c-surface); background: var(--c-surface-2); display: block;
}
.pe-avatar-fallback { display: grid; place-items: center; background: var(--grad-brand); color: #fff; font-size: 1.6rem; font-weight: 700; }
.pe-avatar-actions { position: absolute; right: var(--space-3); bottom: -40px; display: flex; gap: var(--space-2); }
.pe-swatches { display: flex; gap: var(--space-2); }
.pe-swatch { width: 40px; height: 40px; border-radius: 10px; cursor: pointer; display: grid; place-items: center; color: #fff; border: 2px solid transparent; }
.pe-swatch.active { border-color: var(--c-text); }
.pe-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
.field-error { color: var(--c-danger, #ef4444); font-size: 0.8rem; margin: 0 0 var(--space-2); }
@media (max-width: 600px) { .pe-grid { grid-template-columns: 1fr; } }
</style>
