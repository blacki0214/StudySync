<script setup>
/**
 * SchoolDashboardView — the school admin's home (route /school). Phase 0 lays
 * down the shell; the full institution management (create school, invite
 * teachers/students, org roster, analytics) arrives in Phase 1. Kept honest:
 * it shows what an admin will run here rather than fake metrics.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore.js'

const { t } = useI18n()
const auth = useAuthStore()
const firstName = computed(() => (auth.user?.full_name || '').split(' ')[0] || t('editor.someone'))

const upcoming = [
  { icon: 'bi-person-badge', key: 'school.featTeachers' },
  { icon: 'bi-mortarboard', key: 'school.featStudents' },
  { icon: 'bi-easel2', key: 'school.featClasses' },
  { icon: 'bi-graph-up', key: 'school.featAnalytics' }
]
</script>

<template>
  <div>
    <header class="page-head">
      <div>
        <h1 class="ph-title">{{ t('school.welcome', { name: firstName }) }}</h1>
        <p class="ph-sub">{{ t('school.sub') }}</p>
      </div>
    </header>

    <div class="school-hero">
      <span class="school-hero-icon"><i class="bi bi-building"></i></span>
      <div class="school-hero-body">
        <h2>{{ t('school.setupTitle') }}</h2>
        <p>{{ t('school.setupMsg') }}</p>
        <span class="badge-soft school-soon"><i class="bi bi-hourglass-split"></i> {{ t('school.soon') }}</span>
      </div>
    </div>

    <h3 class="school-section-title">{{ t('school.willManage') }}</h3>
    <div class="school-feats">
      <div v-for="f in upcoming" :key="f.key" class="school-feat">
        <span class="icon-tile grad-blue"><i class="bi" :class="f.icon"></i></span>
        <span>{{ t(f.key) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.school-hero {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: var(--space-5);
  margin-bottom: var(--space-6);
}
.school-hero-icon {
  width: 52px; height: 52px; flex-shrink: 0;
  border-radius: 14px; display: grid; place-items: center;
  background: var(--grad-brand); color: #fff; font-size: 1.5rem;
}
.school-hero-body h2 { margin: 0 0 var(--space-2); font-size: 1.25rem; font-weight: 750; }
.school-hero-body p { margin: 0 0 var(--space-3); color: var(--c-text-muted); max-width: 60ch; }
.school-soon { display: inline-flex; align-items: center; gap: 0.35rem; }
.school-section-title { font-size: 0.95rem; font-weight: 700; margin: 0 0 var(--space-3); }
.school-feats { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); }
.school-feat {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--radius); font-weight: 600; font-size: 0.9rem;
}
@media (max-width: 860px) {
  .school-feats { grid-template-columns: repeat(2, 1fr); }
  .school-hero { flex-direction: column; }
}
</style>
