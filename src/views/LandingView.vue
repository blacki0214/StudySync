<script setup>
/** LandingView — public marketing page that introduces the platform. */
const features = [
  { icon: 'bi-people-fill', title: 'Real-time collaboration', text: 'Edit notes together with presence, typing indicators and version conflict handling.' },
  { icon: 'bi-card-text', title: 'Auto flashcards', text: 'Definition-pattern parsing turns your notes into flashcards — no AI API.' },
  { icon: 'bi-patch-question-fill', title: 'Smart quizzes', text: 'Multiple-choice questions with auto-generated distractors and manual shuffling.' },
  { icon: 'bi-bar-chart-steps', title: 'Difficulty analysis', text: 'Rule-based scoring rates each note Easy, Medium or Hard with an explanation.' },
  { icon: 'bi-broadcast', title: 'Study rooms', text: 'Join live rooms, see who is online and watch a real-time activity feed.' },
  { icon: 'bi-clock-history', title: 'Version history', text: 'Every save is snapshotted so you can review or restore earlier versions.' }
]
</script>

<template>
  <div>
    <nav class="landing-nav">
      <div class="landing-brand">
        <span class="brand-mark" style="width:34px;height:34px;border-radius:9px;background:var(--c-primary);display:grid;place-items:center;color:#fff">
          <i class="bi bi-mortarboard-fill"></i>
        </span>
        StudySync Vietnam
      </div>
      <div class="d-flex gap-2">
        <router-link to="/login" class="btn btn-soft">Log in</router-link>
        <router-link to="/register" class="btn btn-brand">Get started</router-link>
      </div>
    </nav>

    <section class="landing-hero">
      <span class="badge-soft mb-3 d-inline-block">COS30043 · Advanced Vue 3 Project</span>
      <h1>Learn together,<br /><span class="hero-grad">in real time.</span></h1>
      <p>
        A collaborative learning platform for university students — real-time note editing,
        manually-built flashcards and quizzes, and live study rooms. No external AI APIs, just
        clever rule-based JavaScript.
      </p>
      <div class="d-flex gap-3 justify-content-center">
        <router-link to="/register" class="btn btn-brand btn-lg">Start studying free</router-link>
        <router-link to="/login" class="btn btn-soft btn-lg">I have an account</router-link>
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

    <footer class="app-footer">© {{ new Date().getFullYear() }} StudySync Vietnam — COS30043 Interface Design and Development.</footer>
  </div>
</template>
