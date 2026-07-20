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

// --- Bulk selection ---------------------------------------------------------
const selectedIds = ref([])
const selectedSet = computed(() => new Set(selectedIds.value))
const selectedCount = computed(() => selectedIds.value.length)
const bulkStatusOptions = computed(() => [{ value: '', label: t('tasks.bulkSetStatus') }, ...store.statuses.map((s) => ({ value: s.id, label: s.name }))])
const bulkPriorityOptions = computed(() => [{ value: '', label: t('tasks.bulkSetPriority') }, ...toOptions(PRIORITIES, t)])

function toggleSelect(id) {
  selectedIds.value = selectedSet.value.has(id)
    ? selectedIds.value.filter((x) => x !== id)
    : [...selectedIds.value, id]
}
// Select/deselect a batch of ids (a view's currently-visible rows).
function toggleAll(ids) {
  const allOn = ids.length > 0 && ids.every((id) => selectedSet.value.has(id))
  selectedIds.value = allOn
    ? selectedIds.value.filter((id) => !ids.includes(id))
    : [...new Set([...selectedIds.value, ...ids])]
}
function clearSelection() { selectedIds.value = [] }

async function bulkStatus(v) {
  if (!v) return
  await store.bulkUpdate(selectedIds.value, { status: v })
  dialog.toast(t('tasks.bulkDone', { n: selectedCount.value }), 'success')
}
async function bulkPriority(v) {
  if (!v) return
  await store.bulkUpdate(selectedIds.value, { priority: v })
  dialog.toast(t('tasks.bulkDone', { n: selectedCount.value }), 'success')
}
async function bulkDue(e) {
  const value = e.target.value || null
  const n = selectedCount.value
  await store.bulkUpdate(selectedIds.value, { due_date: value })
  e.target.value = '' // reset the picker so it stays an "action" control
  dialog.toast(t('tasks.bulkDone', { n }), 'success')
}
async function bulkClearDue() {
  await store.bulkUpdate(selectedIds.value, { due_date: null })
  dialog.toast(t('tasks.bulkDone', { n: selectedCount.value }), 'success')
}
async function bulkAssignee() {
  const name = await dialog.promptText({ title: t('tasks.bulkAssignee'), label: t('tasks.bulkAssigneePrompt') })
  if (name === null) return // cancelled
  await store.bulkUpdate(selectedIds.value, { assignee_name: name.trim() || null })
  dialog.toast(t('tasks.bulkDone', { n: selectedCount.value }), 'success')
}
async function bulkDelete() {
  const n = selectedCount.value
  const ok = await dialog.confirm({ title: t('tasks.bulkDelete'), message: t('tasks.bulkDeleteConfirm', { n }), danger: true })
  if (!ok) return
  await store.bulkRemove(selectedIds.value)
  clearSelection()
  dialog.toast(t('tasks.bulkDeleted', { n }), 'success')
}

// Drop ids that no longer exist (deleted elsewhere) or when the scope reloads.
watch(() => store.tasks, (list) => {
  const live = new Set(list.map((task) => task.id))
  const kept = selectedIds.value.filter((id) => live.has(id))
  if (kept.length !== selectedIds.value.length) selectedIds.value = kept
})

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
watch(() => props.subjectId, (id) => { clearSelection(); store.load({ subjectId: id }) })

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
        :selected-ids="selectedIds"
        @toggle-select="toggleSelect"
        @toggle-all="toggleAll"
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
        :selected-ids="selectedIds"
        @toggle-select="toggleSelect"
        @toggle-all="toggleAll"
        @update="updateTask"
        @open="editingId = $event.id"
        @delete="deleteTask"
        @create="createTask()"
      />
    </template>

    <!-- Bulk action bar — sticky at the bottom while tasks are selected. -->
    <div v-if="selectedCount" class="task-bulkbar">
      <span class="tb-count">{{ t('tasks.selected', { n: selectedCount }) }}</span>
      <AppSelect class="tb-select" :model-value="''" :options="bulkStatusOptions" :aria-label="t('tasks.bulkSetStatus')" @update:model-value="bulkStatus" />
      <AppSelect class="tb-select" :model-value="''" :options="bulkPriorityOptions" :aria-label="t('tasks.bulkSetPriority')" @update:model-value="bulkPriority" />
      <label class="tb-due" :title="t('tasks.bulkSetDue')">
        <i class="bi bi-calendar-event"></i>
        <input type="date" @change="bulkDue" />
      </label>
      <button class="btn btn-outline-soft btn-sm" @click="bulkClearDue"><i class="bi bi-calendar-x"></i>{{ t('tasks.bulkClearDue') }}</button>
      <button class="btn btn-outline-soft btn-sm" @click="bulkAssignee"><i class="bi bi-person"></i>{{ t('tasks.bulkAssignee') }}</button>
      <button class="btn btn-outline-soft btn-sm tb-danger" @click="bulkDelete"><i class="bi bi-trash"></i>{{ t('tasks.bulkDelete') }}</button>
      <div class="tb-spacer"></div>
      <button class="btn btn-soft btn-sm" @click="clearSelection"><i class="bi bi-x-lg"></i>{{ t('tasks.clearSelection') }}</button>
    </div>

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

<style scoped>
/* Themed purely through the --c-* design tokens so it follows light/dark. */
.task-bulkbar {
  position: sticky; bottom: 0; z-index: 20;
  display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;
  margin-top: var(--space-3); padding: 0.6rem 0.85rem; border-radius: var(--radius);
  background: var(--c-surface); border: 1px solid var(--c-border-strong);
  box-shadow: var(--shadow-lg);
}
.task-bulkbar .tb-count {
  font-weight: 700; font-size: 0.85rem; color: var(--c-primary); white-space: nowrap;
  padding-right: var(--space-2); margin-right: var(--space-1);
  border-right: 1px solid var(--c-border);
}
/* Same reason as .task-filter — AppSelect defaults to width:100%. */
.task-bulkbar .tb-select { flex: 0 0 auto; width: auto; min-width: 150px; }
.task-bulkbar .tb-due {
  display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.6rem;
  background: var(--c-surface); color: var(--c-text-muted);
  border: 1px solid var(--c-border-strong); border-radius: var(--radius-sm);
  cursor: pointer; font-size: 0.8rem;
}
.task-bulkbar .tb-due:hover { background: var(--c-surface-2); }
.task-bulkbar .tb-due input[type="date"] {
  border: none; background: transparent; color: var(--c-text); font-size: 0.8rem;
  font-family: inherit; outline: none; cursor: pointer;
}
.task-bulkbar .tb-spacer { flex: 1 1 auto; }
.task-bulkbar .tb-danger { color: var(--c-danger); }
.task-bulkbar .tb-danger:hover { background: rgba(220, 38, 38, 0.1); border-color: var(--c-danger); }

@media (max-width: 720px) {
  .task-bulkbar { gap: var(--space-1); padding: 0.5rem 0.6rem; }
  .task-bulkbar .tb-count { width: 100%; border-right: none; padding-right: 0; }
  .task-bulkbar .tb-select { flex: 1 1 calc(50% - var(--space-1)); min-width: 0; }
  .task-bulkbar .tb-spacer { display: none; }
}
</style>
