<script setup>
/** LandingView — public marketing page that introduces the platform. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { SUPPORTED, setLocale } from '../i18n/index.js'
import logoMark from '../assets/images/logo-mark.png'

const { t, locale } = useI18n()

const features = computed(() => [
  { icon: 'bi-people-fill', title: t('landing.features.collabTitle'), text: t('landing.features.collabText') },
  { icon: 'bi-card-text', title: t('landing.features.flashTitle'), text: t('landing.features.flashText') },
  { icon: 'bi-patch-question-fill', title: t('landing.features.quizTitle'), text: t('landing.features.quizText') },
  { icon: 'bi-bar-chart-steps', title: t('landing.features.diffTitle'), text: t('landing.features.diffText') },
  { icon: 'bi-broadcast', title: t('landing.features.roomsTitle'), text: t('landing.features.roomsText') },
  { icon: 'bi-clock-history', title: t('landing.features.versionTitle'), text: t('landing.features.versionText') }
])
</script>

<template>
  <div>
    <nav class="landing-nav">
      <div class="landing-brand">
        <img :src="logoMark" class="landing-logo" alt="StudySync logo" />
        StudySync <span class="brand-accent">Vietnam</span>
      </div>
      <div class="action-row landing-actions">
        <div class="landing-lang">
          <button
            v-for="l in SUPPORTED"
            :key="l.code"
            class="lang-pill"
            :class="{ active: locale === l.code }"
            @click="setLocale(l.code)"
          >{{ l.short }}</button>
        </div>
        <router-link to="/login" class="btn btn-soft">{{ t('landing.login') }}</router-link>
        <router-link to="/register" class="btn btn-brand">{{ t('landing.getStarted') }}</router-link>
      </div>
    </nav>

    <section class="landing-hero">
      <span class="badge-soft landing-eyebrow">{{ t('landing.eyebrow') }}</span>
      <h1>{{ t('landing.heroLine1') }}<br /><span class="hero-grad">{{ t('landing.heroLine2') }}</span></h1>
      <p>{{ t('landing.heroText') }}</p>
      <div class="hero-actions">
        <router-link to="/register" class="btn btn-brand btn-lg">{{ t('landing.startFree') }}</router-link>
        <router-link to="/login" class="btn btn-soft btn-lg">{{ t('landing.haveAccount') }}</router-link>
      </div>
    </section>

    <section class="feature-grid">
      <div class="row g-4">
        <div v-for="f in features" :key="f.title" class="col-12 col-md-6 col-lg-4">
          <div class="feature-box">
            <div class="fb-icon"><i class="bi" :class="f.icon"></i></div>
            <h3>{{ f.title }}</h3>
            <p>{{ f.text }}</p>
          </div>
        </div>
      </div>
    </section>

    <footer class="app-footer">© {{ new Date().getFullYear() }} StudySync — COS30043 Interface Design and Development.</footer>
  </div>
</template>
