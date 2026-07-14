<script setup>
/**
 * TaskStatusEditor — the "Edit statuses" modal (ClickUp-style). Lets the user
 * start from a built-in or saved template, then add / rename / recolour / delete
 * / reorder statuses within the four lifecycle groups, save the set as a new
 * template, and apply it to the board.
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogStore } from '../../stores/dialogStore.js'
import AppSelect from '../common/AppSelect.vue'
import {
  STATUS_GROUPS, STATUS_COLORS, BUILTIN_TEMPLATES, clone, statusIdFrom
} from '../../utils/taskStatusTemplates.js'

const props = defineProps({
  statuses: { type: Array, default: () => [] },
  templateKey: { type: String, default: null },
  templates: { type: Array, default: () => [] } // user-saved templates
})
const emit = defineEmits(['apply', 'save-template', 'close'])
const { t } = useI18n()
const dialog = useDialogStore()

// Editable working copy.
const draft = ref(clone(props.statuses))
const chosenTemplate = ref(props.templateKey || 'custom')
const colorFor = ref(null) // status id whose colour palette is open

// Template dropdown options: built-ins + the user's saved templates.
const templateOptions = [
  ...BUILTIN_TEMPLATES.map((tpl) => ({ value: tpl.key, label: tpl.name, statuses: tpl.statuses })),
  ...props.templates.map((tpl) => ({ value: tpl.id, label: tpl.name, statuses: tpl.statuses }))
]
// Grouped options for the themed AppSelect (headers via the `group` field).
const templateSelectOptions = computed(() => [
  ...BUILTIN_TEMPLATES.map((tpl) => ({ value: tpl.key, label: tpl.name, group: t('tasks.builtinTemplates') })),
  ...props.templates.map((tpl) => ({ value: tpl.id, label: tpl.name, group: t('tasks.myTemplates') })),
  { value: 'custom', label: t('tasks.customStatuses') }
])

function loadTemplate(key) {
  chosenTemplate.value = key
  const tpl = templateOptions.find((o) => o.value === key)
  if (tpl) draft.value = clone(tpl.statuses)
}

function group(key) { return draft.value.filter((s) => s.group === key) }

function addStatus(groupKey) {
  const ids = draft.value.map((s) => s.id)
  draft.value.push({ id: statusIdFrom('new status', ids), name: 'New status', color: STATUS_COLORS[1], group: groupKey })
  chosenTemplate.value = 'custom'
}
function removeStatus(id) {
  if (draft.value.length <= 1) return
  draft.value = draft.value.filter((s) => s.id !== id)
  chosenTemplate.value = 'custom'
}
function setColor(status, color) { status.color = color; colorFor.value = null; chosenTemplate.value = 'custom' }
function touched() { chosenTemplate.value = 'custom' }

// Reorder a status up/down within the full list (drives column order).
function move(id, dir) {
  const i = draft.value.findIndex((s) => s.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= draft.value.length) return
  const arr = draft.value
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  draft.value = [...arr]
  chosenTemplate.value = 'custom'
}

function valid() {
  return draft.value.length > 0 && draft.value.every((s) => (s.name || '').trim())
}

function apply() {
  if (!valid()) { dialog.toast(t('tasks.statusNamesRequired'), 'warning'); return }
  const key = BUILTIN_TEMPLATES.some((b) => b.key === chosenTemplate.value) ? chosenTemplate.value : null
  emit('apply', { statuses: clone(draft.value), templateKey: key })
}

async function saveAsTemplate() {
  if (!valid()) { dialog.toast(t('tasks.statusNamesRequired'), 'warning'); return }
  const name = await dialog.promptText({ title: t('tasks.saveTemplate'), label: t('tasks.templateName') })
  if (!name || !name.trim()) return
  emit('save-template', { name: name.trim(), statuses: clone(draft.value) })
}
</script>

<template>
  <div class="modal d-block task-status-modal" tabindex="-1" @click.self="emit('close')">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="bi bi-sliders"></i> {{ t('tasks.editStatuses') }}</h5>
          <button class="btn-close" @click="emit('close')"></button>
        </div>

        <div class="modal-body tse-body">
          <!-- Template picker -->
          <div class="tse-template">
            <label class="tse-label">{{ t('tasks.statusTemplate') }}</label>
            <AppSelect :model-value="chosenTemplate" :options="templateSelectOptions" :aria-label="t('tasks.statusTemplate')" @update:model-value="loadTemplate" />
          </div>

          <!-- Groups -->
          <div v-for="g in STATUS_GROUPS" :key="g.key" class="tse-group">
            <div class="tse-group-head">
              <span class="tse-group-label">{{ t(g.i18n) }}</span>
              <button class="tse-add-mini" :title="t('tasks.addStatus')" @click="addStatus(g.key)"><i class="bi bi-plus-lg"></i></button>
            </div>

            <div v-for="s in group(g.key)" :key="s.id" class="tse-row">
              <div class="tse-color">
                <button type="button" class="tse-dot" :style="{ background: s.color }" @click.stop="colorFor = colorFor === s.id ? null : s.id"></button>
                <div v-if="colorFor === s.id" class="tse-palette" @click.stop>
                  <button
                    v-for="c in STATUS_COLORS"
                    :key="c"
                    type="button"
                    class="tse-swatch"
                    :style="{ background: c }"
                    @click="setColor(s, c)"
                  ></button>
                </div>
              </div>
              <input v-model="s.name" class="tse-name" @input="touched" />
              <div class="tse-row-actions">
                <button class="tse-icon" :title="t('tasks.moveUp')" @click="move(s.id, -1)"><i class="bi bi-chevron-up"></i></button>
                <button class="tse-icon" :title="t('tasks.moveDown')" @click="move(s.id, 1)"><i class="bi bi-chevron-down"></i></button>
                <button class="tse-icon danger" :title="t('tasks.delete')" @click="removeStatus(s.id)"><i class="bi bi-x-lg"></i></button>
              </div>
            </div>

            <button class="tse-add" @click="addStatus(g.key)"><i class="bi bi-plus-lg"></i>{{ t('tasks.addStatus') }}</button>
          </div>
        </div>

        <div class="modal-footer tse-foot">
          <button class="btn btn-soft" @click="saveAsTemplate"><i class="bi bi-bookmark-plus"></i>{{ t('tasks.saveTemplate') }}</button>
          <div class="tse-foot-spacer"></div>
          <button class="btn btn-outline-soft" @click="emit('close')">{{ t('common.cancel') }}</button>
          <button class="btn btn-brand" @click="apply">{{ t('tasks.applyChanges') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
