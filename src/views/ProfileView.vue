<script setup>
/**
 * ProfileView — cover banner, identity, stat cards, 12-month reputation chart
 * and the achievements grid (matches the Figma). Layout uses row/col grid; all
 * other styling is semantic classes in styles/profile.css.
 */
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore.js'
import { useContentStore } from '../stores/contentStore.js'
import StatCard from '../components/common/StatCard.vue'
import LineAreaChart from '../components/charts/LineAreaChart.vue'

const auth = useAuthStore()
const content = useContentStore()
const { t } = useI18n()
const user = computed(() => auth.user || {})
onMounted(() => content.ensureLoaded())

// Notes authored by the signed-in user (real count from the store).
const myNotesCount = computed(() => content.notes.filter((n) => n.author_id === user.value.id).length)

// Real headline metrics — no fake deltas. Study sessions / followers have no data
// source yet, so they honestly show 0 until those features exist.
const stats = computed(() => [
  { label: t('profile.reputationPoints'), value: (user.value.reputation ?? 0).toLocaleString(), icon: 'bi-trophy', grad: 'grad-orange' },
  { label: t('profile.notesContributed'), value: myNotesCount.value, icon: 'bi-file-earmark-text', grad: 'grad-blue' },
  { label: t('profile.studySessions'), value: 0, icon: 'bi-journal-bookmark', grad: 'grad-fuchsia' },
  { label: t('profile.followers'), value: 0, icon: 'bi-people', grad: 'grad-green' }
])

const unlockedCount = computed(() => content.achievements.filter((a) => a.unlocked).length)
const joinedDate = computed(() => {
  const d = user.value.joined || user.value.created_at
  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''
})
</script>

<template>
  <div>
    <!-- Cover + identity -->
    <div class="profile-cover"></div>
    <div class="profile-id">
      <img :src="user.avatar_url" class="pi-avatar" :alt="user.full_name" />
      <div class="pi-main">
        <h1 class="pi-name">
          {{ user.full_name }}
          <span v-if="user.tier" class="badge-tier">{{ user.tier }}</span>
          <span v-if="user.percentile" class="badge-soft">{{ user.percentile }}</span>
        </h1>
        <div v-if="user.handle || user.program" class="pi-handle">
          <template v-if="user.handle">@{{ user.handle }}</template>
          <template v-if="user.handle && user.program"> · </template>
          <template v-if="user.program">{{ user.program }}</template>
        </div>
        <div class="pi-meta">
          <span v-if="user.location"><i class="bi bi-geo-alt"></i>{{ user.location }}</span>
          <span v-if="joinedDate"><i class="bi bi-calendar3"></i>{{ t('profile.joined', { date: joinedDate }) }}</span>
          <span><i class="bi bi-trophy"></i>{{ t('profile.reputationMeta', { n: (user.reputation ?? 0).toLocaleString() }) }}</span>
        </div>
      </div>
      <div class="pi-actions">
        <button class="btn btn-outline-soft"><i class="bi bi-share"></i>{{ t('profile.share') }}</button>
        <button class="btn btn-brand"><i class="bi bi-pencil-square"></i>{{ t('profile.edit') }}</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="row g-3 row-gap-section">
      <div v-for="s in stats" :key="s.label" class="col-6 col-xl-3"><StatCard v-bind="s" /></div>
    </div>

    <!-- Reputation chart + achievements -->
    <div class="row g-4">
      <div class="col-12 col-xl-7">
        <div class="chart-card">
          <div class="chart-card-head">
            <div>
              <h3>{{ t('profile.reputationOverTime') }}</h3>
              <div class="chart-sub">{{ t('profile.last12') }}</div>
            </div>
            <span v-if="content.reputationSeries" class="badge-live">{{ t('profile.ytd', { n: content.reputationSeries.ytd.toLocaleString() }) }}</span>
          </div>
          <LineAreaChart v-if="content.reputationSeries" :labels="content.reputationSeries.labels" :values="content.reputationSeries.values" :max="content.reputationSeries.max" :ticks="4" :area="false" :height="280" />
        </div>
      </div>

      <div class="col-12 col-xl-5">
        <div class="panel">
          <div class="chart-card-head">
            <div class="section-title section-title-flush"><i class="bi bi-award"></i>{{ t('profile.achievements') }}</div>
            <span class="ach-count">{{ t('profile.unlockedOf', { n: unlockedCount, total: content.achievements.length }) }}</span>
          </div>
          <div class="row g-3 ach-grid">
            <div v-for="a in content.achievements" :key="a.id" class="col-6">
              <div class="ach-card" :class="{ locked: !a.unlocked }">
                <span class="ach-icon" :class="a.color"><i class="bi" :class="a.icon"></i></span>
                <div class="ach-name">{{ a.name }}</div>
                <div class="ach-desc">{{ a.desc }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
