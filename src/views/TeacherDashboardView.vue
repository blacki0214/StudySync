<script setup>
/**
 * TeacherDashboardView — the teacher's home (route /teach). A teaching-first
 * landing: quick actions, and the classes they host. Teachers keep every
 * personal student feature; this is just where they land by default.
 * (Phase 0 of the teacher/school extension — reuses classStore + class cards.)
 */
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore.js'
import { useClassStore } from '../stores/classStore.js'
import { useSchoolStore } from '../stores/schoolStore.js'
import { useDialogStore } from '../stores/dialogStore.js'
import EmptyState from '../components/common/EmptyState.vue'

const router = useRouter()
const { t } = useI18n()
const auth = useAuthStore()
const classStore = useClassStore()
const school = useSchoolStore()
const dialog = useDialogStore()

const firstName = computed(() => (auth.user?.full_name || '').split(' ')[0] || t('editor.someone'))
const owned = computed(() => classStore.owned)

const baseActions = [
  { key: 'teach.actNewClass', icon: 'bi-plus-lg', grad: 'grad-fuchsia', run: newClass },
  { key: 'teach.actClasses', icon: 'bi-easel2', grad: 'grad-blue', to: '/classes' },
  { key: 'teach.actSchedule', icon: 'bi-calendar-week', grad: 'grad-green', to: '/schedule' },
  { key: 'teach.actRooms', icon: 'bi-people', grad: 'grad-orange', to: '/rooms' }
]
// Offer "Join a school" until the teacher belongs to one.
const actions = computed(() =>
  school.hasSchool
    ? baseActions
    : [{ key: 'teach.actJoinSchool', icon: 'bi-building-add', grad: 'grad-blue', run: joinSchool }, ...baseActions]
)

onMounted(() => {
  if (!classStore.owned.length) classStore.fetchOwned()
  if (!school.loaded) school.loadSchool()
})

async function joinSchool() {
  const code = await dialog.promptText({
    title: t('school.joinTitle'),
    label: t('school.joinLabel'),
    placeholder: t('school.joinPlaceholder')
  })
  if (!code || !code.trim()) return
  try {
    const s = await school.joinByCode(code.trim(), 'teacher')
    dialog.toast(t('school.joined', { name: s.name }), 'success')
  } catch (e) {
    dialog.toast(e.code === 'not_found' ? t('school.joinFailed') : t('classes.createFailed'), 'error')
  }
}

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
async function newClass() {
  const name = await dialog.promptText({
    title: t('classes.new'),
    label: t('classes.name'),
    placeholder: t('classes.namePlaceholder')
  })
  if (!name || !name.trim()) return
  try {
    const row = await classStore.createClass({ name: name.trim() })
    router.push({ name: 'class-detail', params: { id: row.id } })
  } catch {
    dialog.toast(t('classes.createFailed'), 'error')
  }
}
function runAction(a) {
  if (a.run) a.run()
  else if (a.to) router.push(a.to)
}
</script>

<template>
  <div>
    <header class="page-head">
      <div>
        <h1 class="ph-title">{{ t('teach.welcome', { name: firstName }) }}</h1>
        <p class="ph-sub">{{ t('teach.sub') }}</p>
        <span v-if="school.hasSchool" class="badge-soft teach-school-chip"><i class="bi bi-building"></i> {{ school.school.name }}</span>
      </div>
      <div class="action-row">
        <button class="btn btn-brand" @click="newClass"><i class="bi bi-plus-lg"></i>{{ t('classes.new') }}</button>
      </div>
    </header>

    <!-- Quick actions -->
    <div class="teach-actions">
      <button v-for="a in actions" :key="a.key" class="teach-action" @click="runAction(a)">
        <span class="icon-tile" :class="a.grad"><i class="bi" :class="a.icon"></i></span>
        <span class="ta-label">{{ t(a.key) }}</span>
      </button>
    </div>

    <!-- Classes you host -->
    <section class="class-section">
      <div class="section-head">
        <h3>{{ t('teach.yourClasses') }} <span v-if="owned.length" class="seg-count">{{ owned.length }}</span></h3>
        <router-link v-if="owned.length" to="/classes" class="link-muted">{{ t('teach.manageAll') }}</router-link>
      </div>

      <EmptyState
        v-if="!owned.length"
        icon="bi-easel2"
        :title="t('classes.noTeaching')"
        :message="t('classes.noTeachingMsg')"
      >
        <button class="btn btn-brand empty-cta" @click="newClass"><i class="bi bi-plus-lg"></i>{{ t('classes.new') }}</button>
      </EmptyState>

      <div v-else class="row g-4">
        <div v-for="c in owned" :key="c.id" class="col-12 col-md-6 col-xl-4">
          <router-link :to="{ name: 'class-detail', params: { id: c.id } }" class="class-card">
            <span class="icon-tile class-badge" :class="c.color">{{ initials(c.name) }}</span>
            <div class="class-name">{{ c.name }}</div>
            <div class="class-desc">{{ c.description || t('classes.noDesc') }}</div>
            <div class="class-foot"><span class="badge-soft"><i class="bi bi-key"></i> {{ c.code }}</span></div>
          </router-link>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.teach-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}
.teach-action {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}
.teach-action:hover { border-color: var(--c-primary); background: var(--c-hover); }
.teach-action .ta-label { font-weight: 600; font-size: 0.92rem; color: var(--c-text); }
.link-muted { color: var(--c-text-muted); font-size: 0.88rem; font-weight: 600; }
.link-muted:hover { color: var(--c-primary); text-decoration: none; }
.teach-school-chip { display: inline-flex; align-items: center; gap: 0.35rem; margin-top: var(--space-2); }
@media (max-width: 860px) {
  .teach-actions { grid-template-columns: repeat(2, 1fr); }
}
</style>
