<script setup>
/**
 * NoteSearchFilter — search box + subject dropdown + sort selector.
 * Uses v-model on three props so the parent owns the filter state.
 */
defineProps({
  search: { type: String, default: '' },
  subjectId: { type: String, default: '' },
  sort: { type: String, default: 'recent' },
  subjects: { type: Array, default: () => [] }
})
defineEmits(['update:search', 'update:subjectId', 'update:sort'])
</script>

<template>
  <div class="search-filter-bar">
    <div class="search-box">
      <i class="bi bi-search"></i>
      <input
        class="form-control"
        type="search"
        placeholder="Search notes by title or content..."
        :value="search"
        @input="$emit('update:search', $event.target.value)"
      />
    </div>

    <select
      class="form-select"
      style="max-width: 220px"
      :value="subjectId"
      @change="$emit('update:subjectId', $event.target.value)"
    >
      <option value="">All subjects</option>
      <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.code }} — {{ s.name }}</option>
    </select>

    <select
      class="form-select"
      style="max-width: 180px"
      :value="sort"
      @change="$emit('update:sort', $event.target.value)"
    >
      <option value="recent">Most recent</option>
      <option value="likes">Most liked</option>
      <option value="title">Title A–Z</option>
    </select>
  </div>
</template>
