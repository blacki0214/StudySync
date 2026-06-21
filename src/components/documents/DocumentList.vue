<script setup>
/**
 * DocumentList — the sources in a workspace. Each row can be toggled into the
 * "study set" (which feeds the generators + Ask), and removed. Mirrors a
 * NotebookLM source list.
 */
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
defineProps({
  docs: { type: Array, default: () => [] },
  selected: { type: Array, default: () => [] } // selected document ids
})
const emit = defineEmits(['toggle', 'remove'])

const ICONS = { pdf: 'bi-file-earmark-pdf', file: 'bi-file-earmark-text', link: 'bi-link-45deg', text: 'bi-fonts' }
</script>

<template>
  <div class="panel doc-list">
    <div class="section-title"><i class="bi bi-collection"></i>{{ t('workspace.sources') }} <span class="seg-count">{{ docs.length }}</span></div>

    <p v-if="!docs.length" class="doc-empty">{{ t('workspace.noSources') }}</p>

    <ul v-else class="doc-items">
      <li v-for="d in docs" :key="d.id" class="doc-item" :class="{ on: selected.includes(d.id) }">
        <label class="doc-check">
          <input type="checkbox" :checked="selected.includes(d.id)" @change="emit('toggle', d.id)" />
        </label>
        <span class="doc-icon"><i class="bi" :class="ICONS[d.source_type] || 'bi-file-earmark'"></i></span>
        <div class="doc-main">
          <div class="doc-title">{{ d.title }}</div>
          <div class="doc-meta">{{ t('workspace.charsN', { n: d.char_count || 0 }) }}</div>
        </div>
        <button class="doc-remove" :aria-label="t('common.cancel')" @click="emit('remove', d)"><i class="bi bi-trash"></i></button>
      </li>
    </ul>
  </div>
</template>
