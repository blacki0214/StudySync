<script setup>
/**
 * TaskList — the ClickUp-style grouped list: one collapsible section per status
 * (in the board's custom order), each showing its tasks in Name / Assignee /
 * Due date / Priority columns with an inline "+ Add Task" that creates a task
 * already in that status. Changing a task's status moves it between sections.
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppSelect from '../common/AppSelect.vue'
import StatusPicker from './StatusPicker.vue'
import { PRIORITIES, toOptions } from '../../utils/taskMeta.js'
import { isDoneStatus } from '../../utils/taskStatusTemplates.js'

const props = defineProps({
  tasks: { type: Array, default: () => [] },
  statuses: { type: Array, default: () => [] }
})
const emit = defineEmits(['update', 'open', 'delete', 'create'])
const { t } = useI18n()

const collapsed = ref(new Set())
const priorityOptions = computed(() => toOptions(PRIORITIES, t))

const sections = computed(() =>
  props.statuses.map((s) => ({
    status: s,
    items: props.tasks.filter((task) => task.status === s.id).sort((a, b) => a.position - b.position)
  }))
)

function toggle(id) {
  const set = new Set(collapsed.value)
  set.has(id) ? set.delete(id) : set.add(id)
  collapsed.value = set
}
function overdue(task) {
  if (!task.due_date || isDoneStatus(task.status, props.statuses)) return false
  return new Date(task.due_date) < new Date(new Date().toDateString())
}
function initials(name) {
  return (name || '').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
  <div class="task-list">
    <section v-for="sec in sections" :key="sec.status.id" class="tl-section">
      <header class="tl-head" @click="toggle(sec.status.id)">
        <i class="bi tl-caret" :class="collapsed.has(sec.status.id) ? 'bi-chevron-right' : 'bi-chevron-down'"></i>
        <span class="tl-status-pill" :style="{ background: sec.status.color + '22', color: sec.status.color }">
          <span class="status-dot" :style="{ background: sec.status.color }"></span>{{ sec.status.name }}
        </span>
        <span class="tl-count">{{ sec.items.length }}</span>
      </header>

      <template v-if="!collapsed.has(sec.status.id)">
        <!-- Column header -->
        <div class="tl-colhead">
          <span class="tl-c-name">{{ t('tasks.col.title') }}</span>
          <span class="tl-c-assignee">{{ t('tasks.col.assignee') }}</span>
          <span class="tl-c-due">{{ t('tasks.col.due') }}</span>
          <span class="tl-c-priority">{{ t('tasks.col.priority') }}</span>
          <span class="tl-c-actions"></span>
        </div>

        <div v-for="task in sec.items" :key="task.id" class="tl-row">
          <span class="tl-c-name">
            <StatusPicker
              class="tl-status"
              compact
              :model-value="task.status"
              :statuses="statuses"
              @update:model-value="(v) => emit('update', task.id, { status: v })"
            />
            <input
              class="tl-title-input"
              :value="task.title"
              :placeholder="t('tasks.untitled')"
              @input="emit('update', task.id, { title: $event.target.value })"
            />
          </span>
          <span class="tl-c-assignee">
            <span v-if="task.assignee_name" class="tl-avatar" :title="task.assignee_name">{{ initials(task.assignee_name) }}</span>
            <span v-else class="tl-unassigned"><i class="bi bi-person"></i></span>
          </span>
          <span class="tl-c-due">
            <input
              type="date"
              class="tl-date"
              :class="{ overdue: overdue(task) }"
              :value="task.due_date || ''"
              @input="emit('update', task.id, { due_date: $event.target.value || null })"
            />
          </span>
          <span class="tl-c-priority">
            <AppSelect class="tl-priority" :model-value="task.priority" :options="priorityOptions" @update:model-value="(v) => emit('update', task.id, { priority: v })" />
          </span>
          <span class="tl-c-actions">
            <button class="tl-icon" :title="t('tasks.openTask')" @click="emit('open', task)"><i class="bi bi-arrows-angle-expand"></i></button>
            <button class="tl-icon danger" :title="t('tasks.delete')" @click="emit('delete', task.id)"><i class="bi bi-trash"></i></button>
          </span>
        </div>

        <button class="tl-add" @click="emit('create', { status: sec.status.id })">
          <i class="bi bi-plus-lg"></i>{{ t('tasks.add') }}
        </button>
      </template>
    </section>
  </div>
</template>
