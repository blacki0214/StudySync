<script setup>
/**
 * TasksOverview — the Hub's personal task snapshot: how many are done vs. total,
 * plus the next few still-open tasks. Reads the user's personal task board.
 */
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTaskStore } from '../../stores/taskStore.js'
import { isDoneStatus } from '../../utils/taskStatusTemplates.js'

const { t } = useI18n()
const tasks = useTaskStore()

// Load the personal board (subjectId: null) when the Hub opens.
onMounted(() => { if (!tasks.tasks.length && !tasks.loading) tasks.load({ subjectId: null }) })

const counts = computed(() => tasks.counts)
const pct = computed(() => (counts.value.total ? Math.round((counts.value.done / counts.value.total) * 100) : 0))
// Open (not finished) tasks — group-aware so custom done statuses count too.
const open = computed(() =>
  tasks.tasks.filter((tk) => !isDoneStatus(tk.status, tasks.statuses)).slice(0, 4)
)
</script>

<template>
  <div class="panel hub-widget">
    <div class="hub-widget-head">
      <div class="section-title section-title-flush"><i class="bi bi-check2-square"></i>{{ t('hub.tasksTitle') }}</div>
      <router-link to="/tasks" class="link-more">{{ t('common.viewAll') }}<i class="bi bi-chevron-right"></i></router-link>
    </div>

    <div v-if="counts.total" class="hub-tasks-progress">
      <div class="hub-tp-label">{{ t('hub.tasksDone', { done: counts.done, total: counts.total }) }}</div>
      <div class="progress-track"><div class="progress-fill" :style="{ width: pct + '%' }"></div></div>
    </div>

    <p v-if="!counts.total" class="hub-widget-empty">{{ t('hub.noTasks') }}</p>
    <p v-else-if="!open.length" class="hub-widget-empty">{{ t('hub.allTasksDone') }}</p>

    <router-link v-for="tk in open" :key="tk.id" to="/tasks" class="hub-item">
      <span class="hub-item-check" :class="tk.status"><i class="bi" :class="tk.status === 'in_progress' ? 'bi-arrow-repeat' : 'bi-circle'"></i></span>
      <div class="hub-item-body">
        <div class="hub-item-title">{{ tk.title }}</div>
        <div v-if="tk.due_date" class="hub-item-meta">{{ tk.due_date }}</div>
      </div>
    </router-link>
  </div>
</template>
