<script setup>
/**
 * SubjectsView — trending hero, category filter pills, search, and a grid of
 * rich subject cards (matches the Figma). Layout uses row/col grid; all other
 * styling is semantic classes in styles/notes.css.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSubjectStore } from '../stores/subjectStore.js'

const subjectStore = useSubjectStore()
const { t } = useI18n()
const search = ref('')
const category = ref('All')

onMounted(() => subjectStore.fetchSubjects())

// `value` matches the (English) subject category in the data; `key` is the
// translated display label, so filtering works in any language.
const categories = [
  { value: 'All', key: 'subjects.cat.all' },
  { value: 'Computing', key: 'subjects.cat.computing' },
  { value: 'Mathematics', key: 'subjects.cat.mathematics' },
  { value: 'Business', key: 'subjects.cat.business' },
  { value: 'Science', key: 'subjects.cat.science' },
  { value: 'Languages', key: 'subjects.cat.languages' }
]

const filtered = computed(() => {
  let list = subjectStore.subjects
  if (category.value !== 'All') list = list.filter((s) => s.category === category.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter((s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
  }
  return list
})

const trending = computed(() =>
  [...subjectStore.subjects].sort((a, b) => b.students - a.students).slice(0, 2)
)
</script>

<template>
  <div>
    <header class="page-header">
      <h1>{{ t('subjects.title') }}</h1>
      <p>{{ t('subjects.sub') }}</p>
    </header>

    <!-- Trending hero -->
    <section class="trending-hero">
      <div class="th-eyebrow"><i class="bi bi-graph-up-arrow"></i> {{ t('subjects.trendingNow') }}</div>
      <h2>{{ t('subjects.mostActive') }}</h2>
      <div class="row g-3">
        <div v-for="s in trending" :key="s.id" class="col-12 col-md-6">
          <router-link :to="{ name: 'subject-hub', params: { id: s.id } }" class="trending-card">
            <div class="tc-code">{{ s.code }}</div>
            <div class="tc-name">{{ s.name }}</div>
            <div class="tc-meta">
              <span><i class="bi bi-people"></i>{{ s.students.toLocaleString() }}</span>
              <span><i class="bi bi-journal-text"></i>{{ t('subjects.notesCount', { n: s.notes_count }) }}</span>
            </div>
          </router-link>
        </div>
      </div>
    </section>

    <!-- Filters -->
    <div class="filter-bar">
      <div class="search-box">
        <i class="bi bi-search"></i>
        <input v-model="search" type="search" :placeholder="t('subjects.searchPlaceholder')" />
      </div>
      <div class="cat-pills">
        <button
          v-for="c in categories"
          :key="c.value"
          class="cat-pill"
          :class="{ active: category === c.value }"
          @click="category = c.value"
        >{{ t(c.key) }}</button>
      </div>
      <button class="btn btn-outline-soft"><i class="bi bi-funnel"></i>{{ t('subjects.filters') }}</button>
    </div>

    <!-- Subject grid -->
    <div class="row g-4">
      <div v-for="s in filtered" :key="s.id" class="col-12 col-md-6 col-xl-3">
        <router-link :to="{ name: 'subject-hub', params: { id: s.id } }" class="subject-card">
          <span class="icon-tile sc-badge" :class="s.color">{{ s.letters }}</span>
          <div class="sc-code">{{ s.code }} · {{ s.category }}</div>
          <div class="sc-name">{{ s.name }}</div>
          <div class="sc-row">
            <span class="sc-rating"><i class="bi bi-star-fill"></i>{{ s.rating }}</span>
            <span class="sc-notes">{{ t('subjects.notesCount', { n: s.notes_count }) }}</span>
          </div>
          <div class="sc-foot">
            <span class="avatar-stack">
              <span v-for="n in ['A','B','C','D']" :key="n" class="mini-circle">{{ n }}</span>
            </span>
            <span class="sc-students">{{ t('subjects.studentsCount', { n: s.students.toLocaleString() }) }}</span>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>
