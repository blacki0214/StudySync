<script setup>
/** PopularSubjects — quick links to subjects with a note count. */
defineProps({
  subjects: { type: Array, default: () => [] },
  counts: { type: Object, default: () => ({}) } // subjectId -> note count
})
</script>

<template>
  <div class="panel">
    <div class="section-title">
      <i class="bi bi-fire"></i>Popular subjects
      <router-link to="/subjects" class="ms-auto text-muted-sm">View all</router-link>
    </div>

    <router-link
      v-for="s in subjects"
      :key="s.id"
      :to="{ name: 'notes', query: { subject: s.id } }"
      class="subject-chip text-reset text-decoration-none"
    >
      <div>
        <span class="sc-code">{{ s.code }}</span>
        <div class="text-muted-sm">{{ s.name }}</div>
      </div>
      <span class="badge-soft">{{ counts[s.id] || 0 }} notes</span>
    </router-link>
  </div>
</template>
