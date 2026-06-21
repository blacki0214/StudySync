<script setup>
/**
 * ProfileView — cover banner, identity, stat cards, 12-month reputation chart
 * and the achievements grid (matches the Figma). Layout uses row/col grid; all
 * other styling is semantic classes in styles/profile.css.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/authStore.js'
import { reputationSeries, achievements } from '../data/sampleAchievements.js'
import StatCard from '../components/common/StatCard.vue'
import LineAreaChart from '../components/charts/LineAreaChart.vue'

const auth = useAuthStore()
const { t } = useI18n()
const user = computed(() => auth.user || {})

const stats = computed(() => [
  { label: t('profile.reputationPoints'), value: '2,480', icon: 'bi-trophy', grad: 'grad-orange', delta: t('profile.deltaThisWeek', { n: 128 }), deltaType: 'up' },
  { label: t('profile.notesContributed'), value: '47', icon: 'bi-file-earmark-text', grad: 'grad-blue', delta: t('profile.viewsK'), deltaType: 'muted' },
  { label: t('profile.studySessions'), value: '162', icon: 'bi-journal-bookmark', grad: 'grad-fuchsia', delta: t('profile.hoursThisWeek'), deltaType: 'muted' },
  { label: t('profile.followers'), value: '284', icon: 'bi-people', grad: 'grad-green', delta: t('profile.deltaThisWeek', { n: 12 }), deltaType: 'up' }
])

const unlockedCount = achievements.filter((a) => a.unlocked).length
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
          <span class="badge-tier">{{ user.tier || 'Gold IV' }}</span>
          <span class="badge-soft">{{ user.percentile || 'Top 4%' }}</span>
        </h1>
        <div class="pi-handle">@{{ user.handle || 'minhng' }} · Software Engineering, RMIT Vietnam</div>
        <div class="pi-meta">
          <span><i class="bi bi-geo-alt"></i>{{ user.location || 'Hồ Chí Minh' }}</span>
          <span><i class="bi bi-calendar3"></i>{{ t('profile.joined') }}</span>
          <span><i class="bi bi-trophy"></i>{{ t('profile.reputationMeta', { n: (user.reputation || 2480).toLocaleString() }) }}</span>
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
            <span class="badge-live">{{ t('profile.ytd', { n: reputationSeries.ytd.toLocaleString() }) }}</span>
          </div>
          <LineAreaChart :labels="reputationSeries.labels" :values="reputationSeries.values" :max="reputationSeries.max" :ticks="4" :area="false" :height="280" />
        </div>
      </div>

      <div class="col-12 col-xl-5">
        <div class="panel">
          <div class="chart-card-head">
            <div class="section-title section-title-flush"><i class="bi bi-award"></i>{{ t('profile.achievements') }}</div>
            <span class="ach-count">{{ t('profile.unlockedOf', { n: unlockedCount }) }}</span>
          </div>
          <div class="row g-3 ach-grid">
            <div v-for="a in achievements" :key="a.id" class="col-6">
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
