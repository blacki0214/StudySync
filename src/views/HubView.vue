<script setup>
/**
 * HubView — the Study Hub home (formerly the dashboard). It is the platform
 * command-center: a "jump back in" row, quick-launch tiles and a unified
 * activity feed sit above the retained overview (stats, weekly focus chart,
 * upcoming sessions, your subjects, leaderboard).
 *
 * Layout uses Bootstrap's row/col grid only; all other styling is semantic
 * classes from styles/hub.css and styles/dashboard.css.
 */
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore.js'
import { useContentStore } from '../stores/contentStore.js'
import StatCard from '../components/common/StatCard.vue'
import LineAreaChart from '../components/charts/LineAreaChart.vue'
import ContinueStudying from '../components/hub/ContinueStudying.vue'
import QuickLaunch from '../components/hub/QuickLaunch.vue'
import HubActivityFeed from '../components/hub/HubActivityFeed.vue'

const auth = useAuthStore()
const content = useContentStore()
const { t } = useI18n()
onMounted(() => content.ensureLoaded())

// Today's date, formatted from the device clock (no hardcoded date).
const dateLine = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
// Vietnamese given name is the FIRST token (e.g. "Minh Nguyễn" -> "Minh").
const firstName = computed(() => (auth.user?.full_name || '').split(' ')[0] || 'there')

// Total focus hours this week, summed from the real study_stats series.
const studyHours = computed(() => {
  const v = content.weeklyFocus?.values || []
  return Math.round(v.reduce((a, b) => a + b, 0) * 10) / 10
})
// Notes authored by the signed-in user, and the subjects they own.
const myNotesCount = computed(() => content.notes.filter((n) => n.author_id === auth.user?.id).length)
const mySubjectsCount = computed(() => content.subjects.filter((s) => s.owner_id && s.owner_id === auth.user?.id).length)

// Personal study metrics — no ranking/reputation.
const stats = computed(() => [
  { label: t('dashboard.notesShared'), value: myNotesCount.value, icon: 'bi-file-earmark-text', grad: 'grad-blue' },
  { label: t('dashboard.studyHours'), value: studyHours.value + 'h', icon: 'bi-clock', grad: 'grad-green' },
  { label: t('profile.subjects'), value: mySubjectsCount.value, icon: 'bi-folder', grad: 'grad-fuchsia' },
  { label: t('profile.streak'), value: (auth.user?.streak || 0) + 'd', icon: 'bi-fire', grad: 'grad-orange' }
])

const mySubjects = computed(() => content.subjects.filter((s) => s.progress > 0).slice(0, 4))

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
  <div>
    <!-- Greeting + actions -->
    <header class="page-head">
      <div class="dash-greeting">
        <div class="eyebrow">{{ dateLine }}</div>
        <h1>{{ t('dashboard.greeting', { name: firstName }) }} <span>👋</span></h1>
        <p class="greet-sub">{{ t('dashboard.streakLine', { days: auth.user?.streak || 0 }) }}</p>
      </div>
      <div class="action-row">
        <router-link to="/schedule" class="btn btn-outline-soft"><i class="bi bi-calendar3"></i>{{ t('dashboard.schedule') }}</router-link>
        <router-link to="/notes" class="btn btn-brand"><i class="bi bi-plus-lg"></i>{{ t('dashboard.newNote') }}</router-link>
      </div>
    </header>

    <!-- Jump back in -->
    <ContinueStudying />

    <!-- Quick launch tiles -->
    <QuickLaunch />

    <!-- Stat cards -->
    <div class="row g-3 row-gap-section">
      <div v-for="s in stats" :key="s.label" class="col-6 col-xl-3">
        <StatCard v-bind="s" />
      </div>
    </div>

    <!-- Chart + activity feed -->
    <div class="row g-4 row-gap-section">
      <div class="col-12 col-xl-8">
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>{{ t('dashboard.weeklyFocus') }}</h3>
              <div class="chart-sub">{{ t('dashboard.weeklyFocusSub', { hours: studyHours }) }}</div>
            </div>
            <span class="badge-soft">{{ t('dashboard.thisWeek') }}</span>
          </div>
          <LineAreaChart v-if="content.weeklyFocus" :labels="content.weeklyFocus.labels" :values="content.weeklyFocus.values" :max="content.weeklyFocus.max" :ticks="4" area :height="260" />
        </div>
      </div>

      <div class="col-12 col-xl-4">
        <HubActivityFeed />
      </div>
    </div>

    <!-- Upcoming sessions + your subjects -->
    <div class="row g-4 row-gap-section">
      <div class="col-12 col-xl-4">
        <div class="rail-card">
          <div class="rail-head">
            <h3>{{ t('dashboard.upcomingSessions') }}</h3>
            <i class="bi bi-chevron-right rail-chevron"></i>
          </div>
          <div v-for="s in content.sessions" :key="s.id" class="session-item">
            <div class="ses-bar" :style="{ background: s.color }"></div>
            <div class="ses-main">
              <div class="ses-title">{{ s.title }}</div>
              <div class="ses-when">{{ s.when }}</div>
              <div class="ses-foot">
                <span class="avatar-stack">
                  <span v-for="uid in s.avatars" :key="uid" class="mini-av">{{ initials(content.userById(uid)?.full_name) }}</span>
                </span>
                <span class="ses-joining">{{ t('dashboard.joining', { n: s.joining }) }}</span>
              </div>
            </div>
          </div>
          <router-link to="/rooms" class="btn btn-outline-soft open-rooms-btn">{{ t('dashboard.openStudyRooms') }}</router-link>
        </div>
      </div>

      <div class="col-12 col-xl-8">
        <div class="section-head">
          <h3>{{ t('dashboard.yourSubjects') }}</h3>
          <router-link to="/subjects" class="link-more">{{ t('common.viewAll') }} <i class="bi bi-chevron-right"></i></router-link>
        </div>
        <div class="row g-3">
          <div v-for="s in mySubjects" :key="s.id" class="col-12 col-md-6">
            <router-link :to="{ name: 'subject-hub', params: { id: s.id } }" class="subject-progress-card">
              <div class="sp-head">
                <span class="icon-tile sp-icon" :class="s.color">{{ s.letters }}</span>
                <div>
                  <div class="sp-name">{{ s.name }}</div>
                  <div class="sp-code">{{ s.code }}</div>
                </div>
                <span class="sp-pct">{{ s.progress }}%</span>
              </div>
              <div class="progress-track"><div class="progress-fill" :style="{ width: s.progress + '%' }"></div></div>
            </router-link>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
