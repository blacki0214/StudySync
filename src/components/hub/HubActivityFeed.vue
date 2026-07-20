<script setup>
/**
 * HubActivityFeed — a unified, cross-feature stream (notes, decks, tasks,
 * rooms) so the Hub shows everything happening in one place. Each row links
 * into its feature.
 *
 * The events are DERIVED from the user's real content rather than read from an
 * `activities` table: nothing in the app ever wrote to that table, so the feed
 * was always empty outside demo mode. Deriving keeps it truthful with zero
 * bookkeeping — if the content exists, the event is real.
 */
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContentStore } from '../../stores/contentStore.js'
import { useTaskStore } from '../../stores/taskStore.js'
import { useAuthStore } from '../../stores/authStore.js'
import { isDoneStatus } from '../../utils/taskStatusTemplates.js'
import { timeAgo } from '../../utils/formatDate.js'

const MAX_ROWS = 8

const { t } = useI18n()
const content = useContentStore()
const tasks = useTaskStore()
const auth = useAuthStore()

onMounted(() => {
  content.ensureLoaded()
  // The Hub does not otherwise load tasks; fetch them for the feed.
  if (!tasks.tasks.length) tasks.load().catch(() => {})
})

const ts = (v) => (v ? new Date(v).getTime() : 0)

/**
 * Merge every content type into one time-sorted stream. Each entry carries the
 * i18n key + params the template translates, plus its route target.
 */
const activities = computed(() => {
  const uid = auth.user?.id
  const rows = []

  for (const n of content.notes) {
    if (uid && n.author_id && n.author_id !== uid) continue
    const created = ts(n.created_at)
    const updated = ts(n.updated_at) || created
    // An edit well after creation is its own event; otherwise show creation.
    const edited = updated - created > 60000
    rows.push({
      id: `note-${n.id}`,
      at: updated,
      icon: 'bi-file-earmark-text',
      color: '#6366f1',
      key: edited ? 'hub.activity.noteEdited' : 'hub.activity.noteCreated',
      params: { user: t('hub.activity.you'), title: n.title || t('notes.untitled') },
      to: { name: 'note-detail', params: { id: n.id } }
    })
  }

  for (const d of content.decks) {
    if (uid && d.owner_id && d.owner_id !== uid) continue
    rows.push({
      id: `deck-${d.id}`,
      at: ts(d.created_at),
      icon: 'bi-collection',
      color: '#8b5cf6',
      key: 'hub.activity.deckCreated',
      params: { deck: d.title || d.name || '', n: (d.cards || []).length },
      to: { name: 'flashcards' }
    })
  }

  for (const task of tasks.tasks) {
    if (!isDoneStatus(task.status, tasks.statuses)) continue
    rows.push({
      id: `task-${task.id}`,
      at: ts(task.updated_at) || ts(task.created_at),
      icon: 'bi-check2-circle',
      color: '#10b981',
      key: 'hub.activity.taskCompleted',
      params: { title: task.title },
      to: { name: 'tasks' }
    })
  }

  for (const r of content.rooms) {
    rows.push({
      id: `room-${r.id}`,
      at: ts(r.created_at),
      icon: 'bi-people-fill',
      color: '#f59e0b',
      key: 'hub.activity.roomCreated',
      params: { room: r.name || r.title || '' },
      to: { name: 'study-room', params: { id: r.id } }
    })
  }

  return rows
    .filter((r) => r.at > 0)
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_ROWS)
    .map((r) => ({ ...r, ago: timeAgo(r.at) }))
})
</script>

<template>
  <div class="panel hub-activity">
    <div class="section-title"><i class="bi bi-activity"></i>{{ t('hub.recentActivity') }}</div>

    <p v-if="!activities.length" class="hub-activity-empty">{{ t('hub.noActivity') }}</p>

    <router-link
      v-for="a in activities"
      :key="a.id"
      :to="a.to"
      class="activity-row"
    >
      <span class="activity-icon" :style="{ background: a.color }"><i class="bi" :class="a.icon"></i></span>
      <div class="activity-text">
        <div>{{ t(a.key, a.params) }}</div>
        <div class="activity-ago">{{ a.ago }}</div>
      </div>
    </router-link>
  </div>
</template>

<style scoped>
.hub-activity-empty {
  color: var(--c-text-faint);
  font-size: 0.88rem;
  padding: var(--space-4) 0;
  margin: 0;
}
</style>
