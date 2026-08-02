<script setup>
/**
 * GetStartedChecklist — the "first five minutes" card at the top of the Hub.
 * It complements the tour: the tour shows where things are, this gets the user
 * to actually do them.
 *
 * Every item ticks itself off from REAL state (a note they wrote, a task they
 * added, a page they opened) rather than from a "seen" flag, so it stays honest
 * and can't be gamed by clicking through. Dismissing it is remembered per user;
 * the Help menu can bring it back.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/authStore.js'
import { useContentStore } from '../../stores/contentStore.js'
import { useTaskStore } from '../../stores/taskStore.js'
import { useTourStore } from '../../stores/tourStore.js'

const { t } = useI18n()
const auth = useAuthStore()
const content = useContentStore()
const tasks = useTaskStore()
const tour = useTourStore()

const uid = computed(() => auth.user?.id)

const items = computed(() => [
  {
    key: 'profile',
    icon: 'bi-person-badge',
    to: '/settings',
    done: Boolean(auth.user?.avatar_url || auth.user?.bio || auth.user?.program)
  },
  {
    key: 'note',
    icon: 'bi-file-earmark-plus',
    to: '/notes',
    done: content.notes.some((n) => n.author_id && n.author_id === uid.value)
  },
  {
    key: 'task',
    icon: 'bi-check2-square',
    to: '/tasks',
    done: tasks.tasks.length > 0
  },
  {
    key: 'flashcards',
    icon: 'bi-stars',
    to: '/flashcards',
    done: Boolean(tour.milestones.flashcards) || content.decks.some((d) => d.owner_id && d.owner_id === uid.value)
  },
  {
    key: 'rooms',
    icon: 'bi-people',
    to: '/rooms',
    done: Boolean(tour.milestones.rooms) || content.rooms.length > 0
  }
])

const doneCount = computed(() => items.value.filter((i) => i.done).length)
const allDone = computed(() => doneCount.value === items.value.length)
const pct = computed(() => Math.round((doneCount.value / items.value.length) * 100))

// Hidden once dismissed, and only offered to users who are past the first-run
// dialog (otherwise it competes with the welcome card for attention).
const visible = computed(() => !tour.checklistDismissed && !tour.welcomeOpen)
</script>

<template>
  <section v-if="visible" class="gs-card" :class="{ 'is-complete': allDone }">
    <header class="gs-head">
      <div class="gs-head-text">
        <h3 class="gs-title">
          <i class="bi" :class="allDone ? 'bi-trophy-fill' : 'bi-rocket-takeoff'"></i>
          {{ allDone ? t('checklist.titleDone') : t('checklist.title') }}
        </h3>
        <p class="gs-sub">{{ allDone ? t('checklist.subDone') : t('checklist.sub') }}</p>
      </div>
      <button class="gs-dismiss" :aria-label="t('checklist.dismiss')" :title="t('checklist.dismiss')" @click="tour.dismissChecklist()">
        <i class="bi bi-x-lg"></i>
      </button>
    </header>

    <div class="gs-progress">
      <div class="gs-track"><div class="gs-fill" :style="{ width: pct + '%' }"></div></div>
      <span class="gs-count">{{ t('checklist.progress', { done: doneCount, total: items.length }) }}</span>
    </div>

    <ul class="gs-items">
      <li v-for="item in items" :key="item.key">
        <router-link class="gs-item" :class="{ 'is-done': item.done }" :to="item.to">
          <span class="gs-check">
            <i class="bi" :class="item.done ? 'bi-check-circle-fill' : item.icon"></i>
          </span>
          <span class="gs-item-text">
            <span class="gs-item-label">{{ t(`checklist.items.${item.key}.label`) }}</span>
            <span class="gs-item-hint">{{ t(`checklist.items.${item.key}.hint`) }}</span>
          </span>
          <i class="bi bi-chevron-right gs-go"></i>
        </router-link>
      </li>
    </ul>

    <footer v-if="allDone" class="gs-foot">
      <button class="btn btn-brand btn-sm" @click="tour.dismissChecklist()">{{ t('checklist.hideIt') }}</button>
    </footer>
    <footer v-else class="gs-foot">
      <button class="gs-replay" @click="tour.startTour()"><i class="bi bi-play-circle"></i>{{ t('checklist.replayTour') }}</button>
    </footer>
  </section>
</template>
