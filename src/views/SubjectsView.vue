<script setup>
/** SubjectsView — grid of all subjects with a category filter. */
import { ref, computed, onMounted } from 'vue'
import { useSubjectStore } from '../stores/subjectStore.js'
import { useNoteStore } from '../stores/noteStore.js'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'

const subjectStore = useSubjectStore()
const noteStore = useNoteStore()
const category = ref('')

onMounted(async () => {
  await Promise.all([subjectStore.fetchSubjects(), noteStore.fetchNotes()])
})

const filtered = computed(() =>
  category.value
    ? subjectStore.subjects.filter((s) => s.category === category.value)
    : subjectStore.subjects
)

function noteCount(subjectId) {
  return noteStore.notes.filter((n) => n.subject_id === subjectId).length
}
</script>

<template>
  <div>
    <div class="page-header d-flex justify-content-between align-items-end flex-wrap gap-3">
      <div>
        <h1>Subjects</h1>
        <p>Browse subjects and dive into shared notes.</p>
      </div>
      <select v-model="category" class="form-select" style="max-width: 260px">
        <option value="">All categories</option>
        <option v-for="c in subjectStore.categories" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>

    <LoadingSpinner v-if="subjectStore.loading" />

    <div v-else class="row g-4">
      <div v-for="s in filtered" :key="s.id" class="col-12 col-md-6 col-lg-4">
        <router-link :to="{ name: 'notes', query: { subject: s.id } }" class="subject-card d-block text-reset text-decoration-none">
          <span class="subj-cat">{{ s.category }}</span>
          <h3 class="mt-2 mb-1"><span class="subj-code">{{ s.code }}</span></h3>
          <div class="fw-semibold mb-2">{{ s.name }}</div>
          <p class="text-muted-sm">{{ s.description }}</p>
          <span class="badge-soft"><i class="bi bi-journal-text me-1"></i>{{ noteCount(s.id) }} notes</span>
        </router-link>
      </div>
    </div>
  </div>
</template>
