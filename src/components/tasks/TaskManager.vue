<script setup>
/**
 * TaskManager — the self-contained task tracker (toolbar + Table/Board views +
 * editor drawer). Reused for both the personal "My Tasks" page (subjectId null)
 * and a subject's Tasks tab (subjectId set). All data flows through taskStore.
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTaskStore } from '../../stores/taskStore.js'
import { useDialogStore } from '../../stores/dialogStore.js'
import AppSelect from '../common/AppSelect.vue'
import TaskList from './TaskList.vue'
import TaskTable from './TaskTable.vue'
import TaskBoard from './TaskBoard.vue'
import TaskEditor from './TaskEditor.vue'
import TaskStatusEditor from './TaskStatusEditor.vue'
import TaskImport from './TaskImport.vue'
import { PRIORITIES, toOptions } from '../../utils/taskMeta.js'

const props = defineProps({ subjectId: { type: String, default: null } })
const { t } = useI18n()
const store = useTaskStore()
const dialog = useDialogStore()

const viewMode = ref('list') // 'list' | 'board' | 'table'
const search = ref('')
const filterStatus = ref('all')
const filterPriority = ref('all')
const editingId = ref(null)
const showStatusEditor = ref(false)
const showImport = ref(false)

// Status filter options come from the board's live custom statuses.
const statusFilterOptions = computed(() => [
  { value: 'all', label: t('tasks.allStatuses') },
  ...store.statuses.map((s) => ({ value: s.id, label: s.name }))
])
const priorityFilterOptions = computed(() => [{ value: 'all', label: t('tasks.allPriorities') }, ...toOptions(PRIORITIES, t)])

async function applyStatuses({ statuses, templateKey }) {
  await store.saveStatuses(statuses, templateKey)
  showStatusEditor.value = false
  dialog.toast(t('tasks.statusesUpdated'), 'success')
}
async function saveStatusTemplate({ name }) {
  await store.saveStatusTemplate(name)
  dialog.toast(t('tasks.templateSaved'), 'success')
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return store.tasks.filter((task) => {
    if (filterStatus.value !== 'all' && task.status !== filterStatus.value) return false
    if (filterPriority.value !== 'all' && task.priority !== filterPriority.value) return false
    if (q && !((task.title || '').toLowerCase().includes(q) || (task.description || '').toLowerCase().includes(q))) return false
    return true
  })
})
const editingTask = computed(() => store.tasks.find((task) => task.id === editingId.value) || null)
const counts = computed(() => store.counts)
const completion = computed(() => counts.value.total ? Math.round((counts.value.done / counts.value.total) * 1000) / 10 : 0)

onMounted(() => store.load({ subjectId: props.subjectId }))
onBeforeUnmount(() => store.teardown())
// Reload when the subject changes (e.g. navigating between subject workspaces).
watch(() => props.subjectId, (id) => store.load({ subjectId: id }))

async function createTask(patch = {}) {
  const row = await store.create(patch)
  if (row) editingId.value = row.id // open the new task for quick editing
}
function updateTask(id, patch) { store.update(id, patch) }
async function deleteTask(id) {
  await store.remove(id)
  if (editingId.value === id) editingId.value = null
}
async function importTasks(patches) {
  const n = await store.importTasks(patches)
  showImport.value = false
  dialog.toast(t('tasks.importDone', { n }), n ? 'success' : 'warning')
}
</script>

<template>
  <div class="task-manager">
    <!-- Toolbar -->
    <div class="task-toolbar">
      <div class="task-view-switch">
        <button class="tvs-btn" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">
          <i class="bi bi-list-ul"></i>{{ t('tasks.list') }}
        </button>
        <button class="tvs-btn" :class="{ active: viewMode === 'board' }" @click="viewMode = 'board'">
          <i class="bi bi-kanban"></i>{{ t('tasks.board') }}
        </button>
        <button class="tvs-btn" :class="{ active: viewMode === 'table' }" @click="viewMode = 'table'">
          <i class="bi bi-table"></i>{{ t('tasks.table') }}
        </button>
      </div>

      <div class="task-toolbar-spacer"></div>

      <div class="task-search">
        <i class="bi bi-search"></i>
        <input v-model="search" :placeholder="t('tasks.searchPlaceholder')" />
      </div>
      <AppSelect class="task-filter" :model-value="filterStatus" :options="statusFilterOptions" @update:model-value="(v) => filterStatus = v" />
      <AppSelect class="task-filter" :model-value="filterPriority" :options="priorityFilterOptions" @update:model-value="(v) => filterPriority = v" />
      <button class="btn btn-outline-soft" :title="t('tasks.editStatuses')" @click="showStatusEditor = true"><i class="bi bi-sliders"></i>{{ t('tasks.statuses') }}</button>
      <button class="btn btn-outline-soft" :title="t('tasks.importTitle')" @click="showImport = true"><i class="bi bi-upload"></i>{{ t('tasks.import') }}</button>
      <button class="btn btn-brand" @click="createTask()"><i class="bi bi-plus-lg"></i>{{ t('tasks.newTask') }}</button>
    </div>

    <!-- Empty state -->
    <div v-if="!store.loading && !store.tasks.length" class="task-empty">
      <i class="bi bi-check2-circle"></i>
      <p>{{ t('tasks.emptyTitle') }}</p>
      <button class="btn btn-soft" @click="createTask()"><i class="bi bi-plus-lg"></i>{{ t('tasks.newTask') }}</button>
    </div>

    <!-- Views -->
    <template v-else>
      <TaskList
        v-if="viewMode === 'list'"
        :tasks="filtered"
        :statuses="store.statuses"
        @update="updateTask"
        @open="editingId = $event.id"
        @delete="deleteTask"
        @create="createTask($event)"
      />
      <TaskBoard
        v-else-if="viewMode === 'board'"
        :tasks="filtered"
        :statuses="store.statuses"
        @update="updateTask"
        @open="editingId = $event.id"
        @create="createTask($event)"
      />
      <TaskTable
        v-else
        :tasks="filtered"
        :statuses="store.statuses"
        @update="updateTask"
        @open="editingId = $event.id"
        @delete="deleteTask"
        @create="createTask()"
      />
    </template>

    <!-- Completion footer (Notion-style) -->
    <div v-if="store.tasks.length" class="task-completion">
      <span class="tc-label">{{ t('tasks.completed') }}</span>
      <div class="tc-bar"><div class="tc-fill" :style="{ width: completion + '%' }"></div></div>
      <span class="tc-pct">{{ completion }}%</span>
      <span class="tc-counts">{{ t('tasks.summary', { total: counts.total, done: counts.done, active: counts.in_progress }) }}</span>
    </div>

    <!-- Editor drawer -->
    <TaskEditor
      :task="editingTask"
      :statuses="store.statuses"
      @update="updateTask"
      @delete="deleteTask"
      @close="editingId = null"
    />

    <!-- Customize statuses modal -->
    <TaskStatusEditor
      v-if="showStatusEditor"
      :statuses="store.statuses"
      :template-key="store.statusTemplateKey"
      :templates="store.statusTemplates"
      @apply="applyStatuses"
      @save-template="saveStatusTemplate"
      @close="showStatusEditor = false"
    />

    <!-- Import tasks modal -->
    <TaskImport
      v-if="showImport"
      :statuses="store.statuses"
      :fallback-id="store.defaultStatusId"
      @import="importTasks"
      @close="showImport = false"
    />
  </div>
</template>
