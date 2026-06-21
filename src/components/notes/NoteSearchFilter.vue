<script setup>
/**
 * NoteSearchFilter — search box + subject dropdown + sort selector.
 * Uses v-model on three props so the parent owns the filter state.
 */
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps({
  search: { type: String, default: '' },
  subjectId: { type: String, default: '' },
  sort: { type: String, default: 'recent' },
  subjects: { type: Array, default: () => [] }
})
defineEmits(['update:search', 'update:subjectId', 'update:sort'])
</script>

<template>
  <div class="filter-bar">
    <div class="search-box">
      <i class="bi bi-search"></i>
      <input
        class="form-control"
        type="search"
        :placeholder="t('notes.searchPlaceholder')"
        :value="search"
        @input="$emit('update:search', $event.target.value)"
      />
    </div>

    <select
      class="form-select filter-select"
      :value="subjectId"
      @change="$emit('update:subjectId', $event.target.value)"
    >
      <option value="">{{ t('notes.allSubjects') }}</option>
      <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.code }} — {{ s.name }}</option>
    </select>

    <select
      class="form-select filter-select-sm"
      :value="sort"
      @change="$emit('update:sort', $event.target.value)"
    >
      <option value="recent">{{ t('notes.sortRecent') }}</option>
      <option value="likes">{{ t('notes.sortLikes') }}</option>
      <option value="title">{{ t('notes.sortTitle') }}</option>
    </select>
  </div>
</template>
