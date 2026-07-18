<script setup>
/**
 * SchoolDashboardView — the school admin's home (route /school). Phase 1: create
 * a school, share its join code, and manage the roster (teachers + students) and
 * class directory. Membership is by code; students are also auto-enrolled when
 * they join a class that belongs to the school.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore.js'
import { useSchoolStore } from '../stores/schoolStore.js'
import { useDialogStore } from '../stores/dialogStore.js'
import StatCard from '../components/common/StatCard.vue'

const { t } = useI18n()
const auth = useAuthStore()
const school = useSchoolStore()
const dialog = useDialogStore()

const firstName = computed(() => (auth.user?.full_name || '').split(' ')[0] || t('editor.someone'))
const newName = ref('')
const creating = ref(false)

onMounted(() => { if (!school.loaded) school.loadSchool() })

const stats = computed(() => [
  { label: t('school.featTeachers'), value: school.teacherCount, icon: 'bi-person-badge', grad: 'grad-blue' },
  { label: t('school.featStudents'), value: school.studentCount, icon: 'bi-mortarboard', grad: 'grad-green' },
  { label: t('school.featClasses'), value: school.classCount, icon: 'bi-easel2', grad: 'grad-fuchsia' }
])

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
async function createSchool() {
  if (!newName.value.trim() || creating.value) return
  creating.value = true
  try {
    await school.createSchool(newName.value.trim())
    dialog.toast(t('school.created'), 'success')
  } catch {
    dialog.toast(t('school.createFailed'), 'error')
  } finally {
    creating.value = false
  }
}
async function copyCode() {
  try {
    await navigator.clipboard.writeText(school.school.code)
    dialog.toast(t('school.copied'), 'success')
  } catch {
    dialog.toast(t('rooms.inviteCopyFailed'), 'error')
  }
}
async function remove(member) {
  const ok = await dialog.confirm({ message: t('school.removeConfirm', { name: member.full_name || member.profile?.full_name }), danger: true })
  if (!ok) return
  await school.removeMember(member)
}
</script>

<template>
  <div>
    <header class="page-head">
      <div>
        <h1 class="ph-title">{{ school.hasSchool ? school.school.name : t('school.welcome', { name: firstName }) }}</h1>
        <p class="ph-sub">{{ t('school.sub') }}</p>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="school.loading && !school.loaded" class="spinner-wrap"><div class="spinner-border"></div></div>

    <!-- No school yet → create -->
    <div v-else-if="!school.hasSchool" class="school-create">
      <span class="school-hero-icon"><i class="bi bi-building-add"></i></span>
      <h2>{{ t('school.createTitle') }}</h2>
      <p>{{ t('school.createMsg') }}</p>
      <div class="school-create-form">
        <input
          v-model="newName"
          class="form-control"
          :placeholder="t('school.namePlaceholder')"
          @keyup.enter="createSchool"
        />
        <button class="btn btn-brand" :disabled="creating || !newName.trim()" @click="createSchool">
          <span v-if="creating" class="spinner-border spinner-border-sm"></span>
          <i v-else class="bi bi-plus-lg"></i>{{ t('school.create') }}
        </button>
      </div>
    </div>

    <!-- School exists → manage -->
    <template v-else>
      <!-- Join code -->
      <div class="school-code-card">
        <div class="scc-main">
          <div class="scc-label">{{ t('school.code') }}</div>
          <div class="scc-code">{{ school.school.code }}</div>
          <div class="scc-hint">{{ t('school.codeHint') }}</div>
        </div>
        <button class="btn btn-outline-soft" @click="copyCode"><i class="bi bi-clipboard"></i>{{ t('school.copyCode') }}</button>
      </div>

      <!-- Stats -->
      <div class="row g-3 row-gap-section">
        <div v-for="s in stats" :key="s.label" class="col-12 col-md-4"><StatCard v-bind="s" /></div>
      </div>

      <!-- Roster: teachers + students -->
      <div class="row g-4 school-rosters">
        <div class="col-12 col-lg-6">
          <div class="panel">
            <div class="section-title"><i class="bi bi-person-badge"></i>{{ t('school.featTeachers') }} <span class="seg-count">{{ school.teacherCount }}</span></div>
            <p v-if="!school.teachers.length" class="rail-empty-lg">{{ t('school.noTeachers') }}</p>
            <div v-for="m in school.teachers" :key="m.id" class="school-member">
              <span class="sm-avatar">{{ initials(m.full_name || m.profile?.full_name) }}</span>
              <span class="sm-name">{{ m.full_name || m.profile?.full_name }}</span>
              <button class="sm-remove" :title="t('school.remove')" @click="remove(m)"><i class="bi bi-person-dash"></i></button>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-6">
          <div class="panel">
            <div class="section-title"><i class="bi bi-mortarboard"></i>{{ t('school.featStudents') }} <span class="seg-count">{{ school.studentCount }}</span></div>
            <p v-if="!school.students.length" class="rail-empty-lg">{{ t('school.noStudents') }}</p>
            <div v-for="m in school.students" :key="m.id" class="school-member">
              <span class="sm-avatar grad-green">{{ initials(m.full_name || m.profile?.full_name) }}</span>
              <span class="sm-name">{{ m.full_name || m.profile?.full_name }}</span>
              <button class="sm-remove" :title="t('school.remove')" @click="remove(m)"><i class="bi bi-person-dash"></i></button>
            </div>
          </div>
        </div>
      </div>

      <!-- Class directory -->
      <section class="class-section">
        <div class="section-head"><h3>{{ t('school.directory') }} <span v-if="school.classCount" class="seg-count">{{ school.classCount }}</span></h3></div>
        <p v-if="!school.classes.length" class="rail-empty-lg">{{ t('school.noClasses') }}</p>
        <div v-else class="row g-4">
          <div v-for="c in school.classes" :key="c.id" class="col-12 col-md-6 col-xl-4">
            <router-link :to="{ name: 'class-detail', params: { id: c.id } }" class="class-card">
              <span class="icon-tile class-badge" :class="c.color">{{ initials(c.name) }}</span>
              <div class="class-name">{{ c.name }}</div>
              <div class="class-desc">{{ c.description || t('classes.noDesc') }}</div>
              <div class="class-foot"><span class="badge-soft"><i class="bi bi-key"></i> {{ c.code }}</span></div>
            </router-link>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.school-create {
  max-width: 480px; margin: var(--space-6) auto; text-align: center;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--radius); box-shadow: var(--shadow-sm); padding: var(--space-6);
}
.school-hero-icon {
  width: 56px; height: 56px; margin: 0 auto var(--space-4);
  border-radius: 16px; display: grid; place-items: center;
  background: var(--grad-brand); color: #fff; font-size: 1.6rem;
}
.school-create h2 { font-size: 1.3rem; font-weight: 750; margin: 0 0 var(--space-2); }
.school-create p { color: var(--c-text-muted); margin: 0 0 var(--space-4); }
.school-create-form { display: flex; gap: var(--space-2); }
.school-create-form .form-control { flex: 1; }

.school-code-card {
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--radius); box-shadow: var(--shadow-sm);
  padding: var(--space-4) var(--space-5); margin-bottom: var(--space-5);
}
.scc-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-faint); font-weight: 700; }
.scc-code { font-size: 1.6rem; font-weight: 800; letter-spacing: 0.14em; font-family: var(--font-mono, monospace); color: var(--c-primary); }
.scc-hint { font-size: 0.82rem; color: var(--c-text-muted); }

.school-rosters { margin-top: var(--space-2); margin-bottom: var(--space-4); }
.school-member { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-top: 1px solid var(--c-border); }
.school-member:first-of-type { border-top: none; }
.sm-avatar { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; background: var(--grad-brand); color: #fff; font-size: 0.72rem; font-weight: 700; }
.sm-name { flex: 1; min-width: 0; font-weight: 600; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sm-remove { border: none; background: none; color: var(--c-text-faint); cursor: pointer; padding: 0.3rem; border-radius: 6px; }
.sm-remove:hover { color: var(--c-danger); background: var(--c-surface-2); }

@media (max-width: 560px) {
  .school-code-card { flex-direction: column; align-items: flex-start; }
}
</style>
