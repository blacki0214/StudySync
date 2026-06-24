<script setup>
/**
 * DataGridView — Jira-style paged viewer for an imported dataset (the DataGrid
 * node). Shows one page at a time (default 10 rows) inside a bordered box with a
 * quick filter, a row counter and a pager, so a large import stays comfortable
 * to read and never slows the editor. The data itself lives on the node; this is
 * purely a read-only presentation, so editing the note around it is unaffected.
 */
import { ref, computed, watch } from 'vue'
import { NodeViewWrapper } from '@tiptap/vue-3'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  node: { type: Object, required: true },
  editor: { type: Object, required: true },
  deleteNode: { type: Function, required: true },
  selected: { type: Boolean, default: false }
})

const { t } = useI18n()

const allRows = computed(() => props.node.attrs.rows || [])
const hasHeader = computed(() => props.node.attrs.headerRow !== false)
const caption = computed(() => props.node.attrs.caption || '')

const header = computed(() => (hasHeader.value ? allRows.value[0] || [] : []))
const bodyRows = computed(() => (hasHeader.value ? allRows.value.slice(1) : allRows.value))
const colCount = computed(() => allRows.value.reduce((m, r) => Math.max(m, r.length), 0))

const canEdit = computed(() => props.editor?.isEditable)

// Quick filter across all cells (substring, case-insensitive).
const query = ref('')
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return bodyRows.value
  return bodyRows.value.filter((r) => r.some((c) => String(c).toLowerCase().includes(q)))
})

// Pagination.
const sizeOptions = [10, 25, 50, 100]
const pageSize = ref(Number(props.node.attrs.pageSize) || 10)
const page = ref(1)
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)))
const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})
const rangeStart = computed(() => (filtered.value.length ? (page.value - 1) * pageSize.value + 1 : 0))
const rangeEnd = computed(() => Math.min(page.value * pageSize.value, filtered.value.length))

// Reset to page 1 whenever the filter or page size changes, and keep page valid.
watch([query, pageSize], () => { page.value = 1 })
watch(pageCount, (n) => { if (page.value > n) page.value = n })

function go(p) { page.value = Math.min(pageCount.value, Math.max(1, p)) }
// Stop ProseMirror from swallowing clicks/keys aimed at our controls.
function stop(e) { e.stopPropagation() }
</script>

<template>
  <node-view-wrapper class="dg" :class="{ 'dg-selected': selected }" contenteditable="false">
    <!-- Header: title, dimensions, quick filter, delete -->
    <div class="dg-head">
      <i class="bi bi-table dg-ico"></i>
      <span class="dg-title">{{ caption || t('editor.dataGridTitle') }}</span>
      <span class="dg-dim">{{ t('editor.dataGridDims', { rows: bodyRows.length, cols: colCount }) }}</span>
      <div class="dg-spacer"></div>
      <div class="dg-search">
        <i class="bi bi-search"></i>
        <input
          v-model="query"
          type="text"
          :placeholder="t('editor.dataGridFilter')"
          spellcheck="false"
          @mousedown="stop"
          @keydown="stop"
        />
      </div>
      <button v-if="canEdit" class="dg-del" :title="t('editor.delTable')" @mousedown="stop" @click="deleteNode()">
        <i class="bi bi-trash3"></i>
      </button>
    </div>

    <!-- Body: current page only -->
    <div class="dg-scroll">
      <table class="dg-table">
        <thead v-if="hasHeader">
          <tr><th v-for="(h, i) in header" :key="i">{{ h }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="(row, r) in pageRows" :key="r">
            <td v-for="(cell, c) in row" :key="c">{{ cell }}</td>
          </tr>
          <tr v-if="!pageRows.length">
            <td class="dg-empty" :colspan="Math.max(1, colCount)">{{ t('editor.dataGridNoMatch') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer: counts + pager + page size -->
    <div class="dg-foot">
      <span class="dg-count">{{ t('editor.dataGridRange', { start: rangeStart, end: rangeEnd, total: filtered.length }) }}</span>
      <div class="dg-pager">
        <button class="dg-pg" :disabled="page <= 1" :title="t('editor.dataGridFirst')" @mousedown="stop" @click="go(1)"><i class="bi bi-chevron-bar-left"></i></button>
        <button class="dg-pg" :disabled="page <= 1" :title="t('editor.dataGridPrev')" @mousedown="stop" @click="go(page - 1)"><i class="bi bi-chevron-left"></i></button>
        <span class="dg-page">{{ t('editor.dataGridPage', { page, total: pageCount }) }}</span>
        <button class="dg-pg" :disabled="page >= pageCount" :title="t('editor.dataGridNext')" @mousedown="stop" @click="go(page + 1)"><i class="bi bi-chevron-right"></i></button>
        <button class="dg-pg" :disabled="page >= pageCount" :title="t('editor.dataGridLast')" @mousedown="stop" @click="go(pageCount)"><i class="bi bi-chevron-bar-right"></i></button>
      </div>
      <label class="dg-size">
        <span>{{ t('editor.dataGridPerPage') }}</span>
        <select v-model.number="pageSize" @mousedown="stop">
          <option v-for="s in sizeOptions" :key="s" :value="s">{{ s }}</option>
        </select>
      </label>
    </div>
  </node-view-wrapper>
</template>
