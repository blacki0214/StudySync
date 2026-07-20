<script setup>
/**
 * TaskImport — the "Import tasks" modal. The user pastes text/Markdown or JSON
 * (or uploads a .txt/.md/.json/.csv file); it's parsed live by utils/taskImport
 * against the board's real statuses, previewed, then bulk-created on confirm.
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseTasksInput } from '../../utils/taskImport.js'
import { priorityMeta, typeMeta } from '../../utils/taskMeta.js'

const props = defineProps({
  statuses: { type: Array, default: () => [] },
  fallbackId: { type: String, default: 'not_started' }
})
const emit = defineEmits(['import', 'close'])
const { t } = useI18n()

const raw = ref('')
const fileInput = ref(null)

const EXAMPLE = `- [ ] Write the project report !high #research @2026-08-01
- [ ] Draw the ERD diagram !high
- [x] Set up the database schema
* Fix slide reload bug !medium #bugfix
Add accessibility pass #polish`

const result = computed(() => parseTasksInput(raw.value, { statuses: props.statuses, fallbackId: props.fallbackId }))
const tasks = computed(() => result.value.tasks)
const canImport = computed(() => tasks.value.length > 0)

const formatLabel = computed(() => {
  const f = result.value.format
  if (f === 'json') return t('tasks.formatJson')
  if (f === 'text') return t('tasks.formatText')
  return ''
})

function statusName(id) {
  return props.statuses.find((s) => s.id === id)?.name || id
}

async function onFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  raw.value = await file.text()
  if (fileInput.value) fileInput.value.value = '' // allow re-picking the same file
}

function insertExample() { raw.value = EXAMPLE }

function doImport() {
  if (!canImport.value) return
  emit('import', tasks.value)
}
</script>

<template>
  <div class="modal d-block task-import-modal" tabindex="-1" @click.self="emit('close')">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="bi bi-upload"></i> {{ t('tasks.importTitle') }}</h5>
          <button class="btn-close" @click="emit('close')"></button>
        </div>

        <div class="modal-body ti-body">
          <p class="ti-help">{{ t('tasks.importHelp') }}</p>

          <div class="ti-actions">
            <button class="btn btn-outline-soft btn-sm" @click="fileInput?.click()">
              <i class="bi bi-file-earmark-arrow-up"></i>{{ t('tasks.importFromFile') }}
            </button>
            <input ref="fileInput" type="file" accept=".txt,.md,.json,.csv,.tsv" class="d-none" @change="onFile" />
            <button class="btn btn-outline-soft btn-sm" @click="insertExample">
              <i class="bi bi-lightbulb"></i>{{ t('tasks.importExample') }}
            </button>
            <span v-if="formatLabel" class="ti-format-badge">{{ formatLabel }}</span>
          </div>

          <textarea
            v-model="raw"
            class="ti-textarea"
            :placeholder="t('tasks.importPlaceholder')"
            spellcheck="false"
          ></textarea>

          <p class="ti-syntax">{{ t('tasks.importSyntax') }}</p>

          <!-- Parse errors / skipped rows -->
          <div v-if="result.errors.length" class="ti-errors">
            <i class="bi bi-exclamation-triangle"></i>
            <ul><li v-for="(err, i) in result.errors" :key="i">{{ err }}</li></ul>
          </div>

          <!-- Preview -->
          <div class="ti-preview">
            <div class="ti-preview-head">
              <span>{{ t('tasks.importPreview') }}</span>
              <span class="ti-count">{{ t('tasks.importCount', { n: tasks.length }) }}</span>
            </div>
            <div v-if="!tasks.length" class="ti-preview-empty">{{ t('tasks.importEmpty') }}</div>
            <ul v-else class="ti-list">
              <li v-for="(task, i) in tasks" :key="i" class="ti-item">
                <span class="ti-item-title">{{ task.title }}</span>
                <span class="ti-chip st-chip">{{ statusName(task.status) }}</span>
                <span class="ti-chip" :class="priorityMeta(task.priority).cls">{{ t(priorityMeta(task.priority).i18n) }}</span>
                <span class="ti-chip" :class="typeMeta(task.type).cls">{{ t(typeMeta(task.type).i18n) }}</span>
                <span v-if="task.dueDate" class="ti-chip ti-due"><i class="bi bi-calendar-event"></i>{{ task.dueDate }}</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline-soft" @click="emit('close')">{{ t('common.cancel') }}</button>
          <button class="btn btn-brand" :disabled="!canImport" @click="doImport">
            <i class="bi bi-upload"></i>{{ t('tasks.importBtn', { n: tasks.length }) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Themed purely through the --c-* design tokens so it follows light/dark. */
.ti-help { color: var(--c-text-muted); font-size: 0.9rem; margin-bottom: var(--space-3); }
.ti-actions { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2); flex-wrap: wrap; }
.ti-format-badge {
  margin-left: auto; font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: var(--radius-pill);
  background: var(--c-primary-light); color: var(--c-primary-dark); font-weight: 600;
}
.ti-textarea {
  width: 100%; min-height: 160px; resize: vertical; font-family: var(--font-mono);
  font-size: 0.85rem; line-height: 1.5; padding: 0.65rem 0.75rem; border-radius: var(--radius-sm);
  border: 1px solid var(--c-border-strong); background: var(--c-surface); color: var(--c-text);
}
.ti-textarea::placeholder { color: var(--c-text-faint); }
.ti-textarea:focus { outline: none; border-color: var(--c-primary); box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25); }
.ti-syntax { font-size: 0.75rem; color: var(--c-text-faint); margin: 0.4rem 0 0; }
.ti-errors {
  margin-top: var(--space-3); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm);
  background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--c-danger); font-size: 0.8rem;
}
.ti-errors ul { margin: 0.25rem 0 0; padding-left: 1.1rem; }
.ti-preview { margin-top: var(--space-4); }
.ti-preview-head { display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.4rem; color: var(--c-text); }
.ti-count { color: var(--c-primary); }
.ti-preview-empty {
  color: var(--c-text-faint); font-size: 0.85rem; padding: var(--space-3); text-align: center;
  border: 1px dashed var(--c-border-strong); border-radius: var(--radius-sm);
}
.ti-list { list-style: none; margin: 0; padding: 0; max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.35rem; }
.ti-item {
  display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
  padding: 0.4rem 0.55rem; border-radius: var(--radius-sm);
  background: var(--c-surface-2); border: 1px solid var(--c-border);
}
.ti-item-title { flex: 1 1 40%; font-size: 0.85rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--c-text); }
.ti-chip { font-size: 0.7rem; padding: 0.08rem 0.45rem; border-radius: var(--radius-pill); font-weight: 600; white-space: nowrap; }
.st-chip { background: var(--c-hover); color: var(--c-text-muted); }
.ti-due { background: var(--c-hover); color: var(--c-text-muted); display: inline-flex; align-items: center; gap: 0.25rem; }
</style>
