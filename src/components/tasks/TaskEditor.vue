<script setup>
/**
 * TaskEditor — a right-side drawer for editing every field of a task. Stateless:
 * each change emits `update(id, patch)` so the store applies it optimistically
 * and live-syncs. Also emits `delete` and `close`.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppSelect from '../common/AppSelect.vue'
import StatusPicker from './StatusPicker.vue'
import { PRIORITIES, TYPES, toOptions } from '../../utils/taskMeta.js'

const props = defineProps({
  task: { type: Object, default: null },
  statuses: { type: Array, default: () => [] }
})
const emit = defineEmits(['update', 'delete', 'close'])
const { t } = useI18n()

const priorityOptions = computed(() => toOptions(PRIORITIES, t))
const typeOptions = computed(() => toOptions(TYPES, t))

function set(patch) { if (props.task) emit('update', props.task.id, patch) }
</script>

<template>
  <div v-if="task" class="task-drawer-scrim" @click.self="emit('close')">
    <aside class="task-drawer">
      <header class="task-drawer-head">
        <span class="task-drawer-eyebrow">{{ t('tasks.editTask') }}</span>
        <button class="btn-close" @click="emit('close')"></button>
      </header>

      <label class="task-field">
        <span class="task-field-label">{{ t('tasks.col.title') }}</span>
        <input
          class="task-input task-title-input"
          :value="task.title"
          :placeholder="t('tasks.untitled')"
          @input="set({ title: $event.target.value })"
        />
      </label>

      <div class="task-field-grid">
        <label class="task-field">
          <span class="task-field-label">{{ t('tasks.col.status') }}</span>
          <StatusPicker :model-value="task.status" :statuses="statuses" @update:model-value="(v) => set({ status: v })" />
        </label>
        <label class="task-field">
          <span class="task-field-label">{{ t('tasks.col.priority') }}</span>
          <AppSelect :model-value="task.priority" :options="priorityOptions" @update:model-value="(v) => set({ priority: v })" />
        </label>
        <label class="task-field">
          <span class="task-field-label">{{ t('tasks.col.type') }}</span>
          <AppSelect :model-value="task.type" :options="typeOptions" @update:model-value="(v) => set({ type: v })" />
        </label>
        <label class="task-field">
          <span class="task-field-label">{{ t('tasks.col.due') }}</span>
          <input
            type="date"
            class="task-input"
            :value="task.due_date || ''"
            @input="set({ due_date: $event.target.value || null })"
          />
        </label>
      </div>

      <label class="task-field">
        <span class="task-field-label">{{ t('tasks.col.assignee') }}</span>
        <input
          class="task-input"
          :value="task.assignee_name || ''"
          :placeholder="t('tasks.unassigned')"
          @input="set({ assignee_name: $event.target.value })"
        />
      </label>

      <label class="task-field">
        <span class="task-field-label">{{ t('tasks.col.description') }}</span>
        <textarea
          class="task-input task-textarea"
          rows="6"
          :value="task.description || ''"
          :placeholder="t('tasks.descPlaceholder')"
          @input="set({ description: $event.target.value })"
        ></textarea>
      </label>

      <footer class="task-drawer-foot">
        <button class="btn btn-danger-soft" @click="emit('delete', task.id)">
          <i class="bi bi-trash"></i>{{ t('tasks.delete') }}
        </button>
        <button class="btn btn-soft" @click="emit('close')">{{ t('common.done') }}</button>
      </footer>
    </aside>
  </div>
</template>
