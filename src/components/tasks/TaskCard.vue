<script setup>
/**
 * TaskCard — a draggable card used in the Kanban board. Shows the title, a due
 * date (red when overdue), priority + type chips and the assignee initials.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import TaskChip from './TaskChip.vue'
import { isDoneStatus } from '../../utils/taskStatusTemplates.js'

const props = defineProps({ task: { type: Object, required: true } })
const emit = defineEmits(['open', 'dragstart'])
const { t } = useI18n()

const overdue = computed(() => {
  if (!props.task.due_date || isDoneStatus(props.task.status)) return false
  return new Date(props.task.due_date) < new Date(new Date().toDateString())
})
function initials(name) {
  return (name || '').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
  <article
    class="task-card"
    draggable="true"
    @click="emit('open', task)"
    @dragstart="emit('dragstart', task)"
  >
    <div class="task-card-title">{{ task.title || t('tasks.untitled') }}</div>
    <div class="task-card-meta">
      <TaskChip kind="priority" :value="task.priority" />
      <TaskChip kind="type" :value="task.type" />
    </div>
    <div class="task-card-foot">
      <span v-if="task.due_date" class="task-due" :class="{ overdue }">
        <i class="bi bi-calendar-event"></i>{{ task.due_date }}
      </span>
      <span v-else class="task-due muted">—</span>
      <span v-if="task.assignee_name" class="task-assignee" :title="task.assignee_name">{{ initials(task.assignee_name) }}</span>
    </div>
  </article>
</template>
