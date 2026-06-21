<script setup>
/**
 * NoteSearchFilter — search box + subject dropdown + sort selector.
 * Uses v-model on three props so the parent owns the filter state.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppSelect from '../common/AppSelect.vue'

const { t } = useI18n()

const props = defineProps({
  search: { type: String, default: '' },
  subjectId: { type: String, default: '' },
  sort: { type: String, default: 'recent' },
  subjects: { type: Array, default: () => [] }
})
defineEmits(['update:search', 'update:subjectId', 'update:sort'])

const subjectOptions = computed(() => [
  { value: '', label: t('notes.allSubjects') },
  ...props.subjects.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))
])
const sortOptions = computed(() => [
  { value: 'recent', label: t('notes.sortRecent') },
  { value: 'likes', label: t('notes.sortLikes') },
  { value: 'title', label: t('notes.sortTitle') }
])
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

    <AppSelect
      class="filter-select"
      :model-value="subjectId"
      :options="subjectOptions"
      :aria-label="t('notes.allSubjects')"
      @update:model-value="$emit('update:subjectId', $event)"
    />

    <AppSelect
      class="filter-select-sm"
      :model-value="sort"
      :options="sortOptions"
      :aria-label="t('notes.sortRecent')"
      @update:model-value="$emit('update:sort', $event)"
    />
  </div>
</template>
