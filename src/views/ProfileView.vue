<script setup>
/**
 * ProfileView — cover banner, identity and a few personal study stats. This is a
 * student-focused profile: no reputation/leaderboard ranking, just the user's
 * own activity (notes, subjects, classes, streak) and any achievements.
 */
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore.js'
import { useContentStore } from '../stores/contentStore.js'
import { useClassStore } from '../stores/classStore.js'
import StatCard from '../components/common/StatCard.vue'

const auth = useAuthStore()
const content = useContentStore()
const classStore = useClassStore()
const { t } = useI18n()
const user = computed(() => auth.user || {})

onMounted(() => {
  content.ensureLoaded()
  classStore.fetchAll()
})

const myNotesCount = computed(() => content.notes.filter((n) => n.author_id === user.value.id).length)
const mySubjectsCount = computed(() => content.subjects.filter((s) => s.owner_id && s.owner_id === user.value.id).length)
const myClassesCount = computed(() => classStore.owned.length + classStore.enrolled.length)

// Personal, non-comparative stats only.
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
</script>

<template>
  <div>
    <!-- Cover + identity (one card) -->
    <div class="profile-header">
      <div class="profile-cover"></div>
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
            <span v-if="user.location"><i class="bi bi-geo-alt"></i>{{ user.location }}</span>
            <span v-if="joinedDate"><i class="bi bi-calendar3"></i>{{ t('profile.joined', { date: joinedDate }) }}</span>
            <span v-if="user.role"><i class="bi bi-mortarboard"></i>{{ user.role === 'teacher' ? t('auth.roleTeacher') : t('auth.roleStudent') }}</span>
          </div>
        </div>
        <div class="pi-actions">
          <button class="btn btn-brand"><i class="bi bi-pencil-square"></i>{{ t('profile.edit') }}</button>
        </div>
      </div>
    </div>

    <!-- Personal stats -->
    <div class="row g-3 row-gap-section">
      <div v-for="s in stats" :key="s.label" class="col-6 col-xl-3"><StatCard v-bind="s" /></div>
    </div>

    <!-- Achievements (personal milestones; hidden when none) -->
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
  </div>
</template>
