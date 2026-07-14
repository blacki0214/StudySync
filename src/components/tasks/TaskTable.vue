<script setup>
/**
 * TaskTable — the Notion-style grid. Title is editable inline; status, priority
 * and type use AppSelect; due date is a native date input. The description cell
 * opens the full editor drawer. A "+ New task" row appends a task.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppSelect from '../common/AppSelect.vue'
import StatusPicker from './StatusPicker.vue'
import { PRIORITIES, TYPES, toOptions } from '../../utils/taskMeta.js'
import { isDoneStatus } from '../../utils/taskStatusTemplates.js'

const props = defineProps({
  tasks: { type: Array, default: () => [] },
  statuses: { type: Array, default: () => [] }
})
const emit = defineEmits(['update', 'open', 'delete', 'create'])
const { t } = useI18n()

const priorityOptions = computed(() => toOptions(PRIORITIES, t))
const typeOptions = computed(() => toOptions(TYPES, t))

function overdue(task) {
  if (!task.due_date || isDoneStatus(task.status, props.statuses)) return false
  return new Date(task.due_date) < new Date(new Date().toDateString())
}
</script>

<template>
  <div class="task-table-wrap">
    <div class="task-table" role="table">
      <!-- Header -->
      <div class="task-thead" role="row">
        <span class="tt-col tt-title">{{ t('tasks.col.title') }}</span>
        <span class="tt-col tt-status">{{ t('tasks.col.status') }}</span>
        <span class="tt-col tt-assignee">{{ t('tasks.col.assignee') }}</span>
        <span class="tt-col tt-due">{{ t('tasks.col.due') }}</span>
        <span class="tt-col tt-priority">{{ t('tasks.col.priority') }}</span>
        <span class="tt-col tt-type">{{ t('tasks.col.type') }}</span>
        <span class="tt-col tt-desc">{{ t('tasks.col.description') }}</span>
        <span class="tt-col tt-actions"></span>
      </div>

      <!-- Rows -->
      <div v-for="task in tasks" :key="task.id" class="task-trow" role="row">
        <span class="tt-col tt-title">
          <input
            class="tt-title-input"
            :value="task.title"
            :placeholder="t('tasks.untitled')"
            @input="emit('update', task.id, { title: $event.target.value })"
          />
        </span>
        <span class="tt-col tt-status">
          <StatusPicker :model-value="task.status" :statuses="statuses" @update:model-value="(v) => emit('update', task.id, { status: v })" />
        </span>
        <span class="tt-col tt-assignee">{{ task.assignee_name || t('tasks.unassigned') }}</span>
        <span class="tt-col tt-due">
          <input
            type="date"
            class="tt-date"
            :class="{ overdue: overdue(task) }"
            :value="task.due_date || ''"
            @input="emit('update', task.id, { due_date: $event.target.value || null })"
          />
        </span>
        <span class="tt-col tt-priority">
          <AppSelect class="tt-select" :model-value="task.priority" :options="priorityOptions" @update:model-value="(v) => emit('update', task.id, { priority: v })" />
        </span>
        <span class="tt-col tt-type">
          <AppSelect class="tt-select" :model-value="task.type" :options="typeOptions" @update:model-value="(v) => emit('update', task.id, { type: v })" />
        </span>
        <span class="tt-col tt-desc">
          <button class="tt-desc-btn" @click="emit('open', task)">
            <span v-if="task.description" class="tt-desc-text">{{ task.description }}</span>
            <span v-else class="tt-desc-empty">{{ t('tasks.addDetails') }}</span>
          </button>
        </span>
        <span class="tt-col tt-actions">
          <button class="tt-icon" :title="t('tasks.openTask')" @click="emit('open', task)"><i class="bi bi-arrows-angle-expand"></i></button>
          <button class="tt-icon tt-del" :title="t('tasks.delete')" @click="emit('delete', task.id)"><i class="bi bi-trash"></i></button>
        </span>
      </div>

      <!-- Add row -->
      <button class="task-add-row" @click="emit('create')">
        <i class="bi bi-plus-lg"></i>{{ t('tasks.newTask') }}
      </button>
    </div>
  </div>
</template>
