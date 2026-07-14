<script setup>
/**
 * TaskBoard — a Kanban board with one column per status. Cards are dragged
 * between columns (native HTML5 drag-and-drop); dropping on a column emits an
 * `update` that changes the task's status. Each column footer adds a task
 * pre-set to that status.
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import TaskCard from './TaskCard.vue'

const props = defineProps({
  tasks: { type: Array, default: () => [] },
  statuses: { type: Array, default: () => [] }
})
const emit = defineEmits(['update', 'open', 'create'])
const { t } = useI18n()

const dragId = ref(null)
const dragOver = ref(null)

const columns = computed(() =>
  props.statuses.map((s) => ({
    ...s,
    items: props.tasks.filter((task) => task.status === s.id).sort((a, b) => a.position - b.position)
  }))
)

function onDragStart(task) { dragId.value = task.id }
function onDrop(status) {
  const id = dragId.value
  dragOver.value = null
  dragId.value = null
  if (!id) return
  const task = props.tasks.find((x) => x.id === id)
  if (task && task.status !== status) emit('update', id, { status })
}
</script>

<template>
  <div class="task-board">
    <section
      v-for="col in columns"
      :key="col.id"
      class="task-col"
      :class="{ 'drag-over': dragOver === col.id }"
      @dragover.prevent="dragOver = col.id"
      @dragleave="dragOver = (dragOver === col.id ? null : dragOver)"
      @drop="onDrop(col.id)"
    >
      <header class="task-col-head">
        <span class="task-chip" :style="{ background: col.color + '22', color: col.color }"><span class="task-chip-dot" :style="{ background: col.color }"></span>{{ col.name }}</span>
        <span class="task-col-count">{{ col.items.length }}</span>
      </header>

      <div class="task-col-body">
        <TaskCard
          v-for="task in col.items"
          :key="task.id"
          :task="task"
          @open="emit('open', $event)"
          @dragstart="onDragStart"
        />
      </div>

      <button class="task-col-add" @click="emit('create', { status: col.id })">
        <i class="bi bi-plus-lg"></i>{{ t('tasks.add') }}
      </button>
    </section>
  </div>
</template>
