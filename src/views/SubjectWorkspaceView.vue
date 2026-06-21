<script setup>
/**
 * SubjectWorkspaceView — the NotebookLM-style workspace for one subject:
 *   • Left   : add sources + the source list (toggle which feed the study set)
 *   • Center : generated study material (summary / flashcards / quiz / keywords)
 *   • Right  : extractive "Ask your sources"
 * All generation is the existing rule-based "manual AI" run over the combined
 * text of the selected documents. Export to Markdown / CSV / Anki.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSubjectStore } from '../stores/subjectStore.js'
import { useDocumentStore } from '../stores/documentStore.js'
import { useAiStore } from '../stores/aiStore.js'
import { exportStudyMarkdown, exportFlashcardsCsv, exportFlashcardsAnki } from '../utils/exporters.js'
import DocumentUploader from '../components/documents/DocumentUploader.vue'
import DocumentList from '../components/documents/DocumentList.vue'
import AskSourcesPanel from '../components/documents/AskSourcesPanel.vue'
import StudySummary from '../components/ai/StudySummary.vue'
import FlashcardGenerator from '../components/ai/FlashcardGenerator.vue'
import QuizGenerator from '../components/ai/QuizGenerator.vue'
import KeywordExtractor from '../components/ai/KeywordExtractor.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'

const props = defineProps({ id: { type: String, required: true } })
const { t } = useI18n()
const subjectStore = useSubjectStore()
const documentStore = useDocumentStore()
const aiStore = useAiStore()

const ready = ref(false)
const busy = ref(false)
const tab = ref('summary')
const selected = ref([]) // selected document ids
const showExport = ref(false)

const subject = computed(() => subjectStore.getById(props.id))
const docs = computed(() => documentStore.forSubject(props.id))
const selectedDocs = computed(() => docs.value.filter((d) => selected.value.includes(d.id)))
const corpus = computed(() => selectedDocs.value.map((d) => d.extracted_text || '').join('\n\n').trim())
const hasMaterial = computed(() => corpus.value.length > 0)

onMounted(async () => {
  if (!subjectStore.subjects.length) await subjectStore.fetchSubjects()
  await documentStore.fetchForSubject(props.id)
  selected.value = docs.value.map((d) => d.id) // study everything by default
  ready.value = true
})

// Keep selection valid as documents are added/removed.
watch(docs, (list) => {
  const ids = new Set(list.map((d) => d.id))
  selected.value = selected.value.filter((id) => ids.has(id))
})

function toggle(id) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((x) => x !== id)
    : [...selected.value, id]
}

async function add(payload) {
  busy.value = true
  try {
    const row = await documentStore.addDocument({ subjectId: props.id, ...payload })
    selected.value = [...selected.value, row.id]
  } finally {
    busy.value = false
  }
}

async function remove(doc) {
  await documentStore.removeDocument(props.id, doc)
}

function doExport(kind) {
  showExport.value = false
  aiStore.analyzeDocuments(selectedDocs.value)
  const name = subject.value?.name || 'StudySync'
  if (kind === 'md') exportStudyMarkdown({ name, summary: aiStore.summary, flashcards: aiStore.flashcards, quiz: aiStore.quiz })
  else if (kind === 'csv') exportFlashcardsCsv(aiStore.flashcards, name)
  else if (kind === 'anki') exportFlashcardsAnki(aiStore.flashcards, name)
}
</script>

<template>
  <LoadingSpinner v-if="!ready" :label="t('workspace.loading')" />

  <div v-else-if="!subject" class="empty-state">
    <i class="bi bi-folder-x empty-icon"></i>
    <p>{{ t('workspace.notFound') }}</p>
    <router-link to="/my-subjects" class="btn btn-brand">{{ t('mySubjects.title') }}</router-link>
  </div>

  <div v-else class="workspace">
    <!-- Header -->
    <header class="page-head">
      <div class="ws-head">
        <span class="icon-tile ws-badge" :class="subject.color">{{ subject.letters }}</span>
        <div>
          <h1 class="ph-title">{{ subject.name }}</h1>
          <p class="ph-sub">{{ t('workspace.sub', { n: docs.length }) }}</p>
        </div>
      </div>
      <div class="action-row">
        <div class="dropdown">
          <button class="btn btn-outline-soft" :disabled="!hasMaterial" data-bs-toggle="dropdown">
            <i class="bi bi-download"></i>{{ t('workspace.export') }}
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><button class="dropdown-item" @click="doExport('md')"><i class="bi bi-markdown"></i>{{ t('workspace.exportMd') }}</button></li>
            <li><button class="dropdown-item" @click="doExport('csv')"><i class="bi bi-filetype-csv"></i>{{ t('workspace.exportCsv') }}</button></li>
            <li><button class="dropdown-item" @click="doExport('anki')"><i class="bi bi-card-text"></i>{{ t('workspace.exportAnki') }}</button></li>
          </ul>
        </div>
      </div>
    </header>

    <div class="workspace-grid">
      <!-- Left: sources -->
      <aside class="ws-col ws-sources">
        <DocumentUploader :busy="busy" @add="add" />
        <DocumentList :docs="docs" :selected="selected" @toggle="toggle" @remove="remove" />
      </aside>

      <!-- Center: study material -->
      <section class="ws-col ws-material">
        <div v-if="!hasMaterial" class="panel empty-state">
          <i class="bi bi-stars empty-icon"></i>
          <p>{{ t('workspace.materialEmpty') }}</p>
        </div>
        <template v-else>
          <div class="text-tabs">
            <button class="text-tab" :class="{ active: tab==='summary' }" @click="tab='summary'">{{ t('workspace.tabSummary') }}</button>
            <button class="text-tab" :class="{ active: tab==='flashcards' }" @click="tab='flashcards'">{{ t('workspace.tabFlashcards') }}</button>
            <button class="text-tab" :class="{ active: tab==='quiz' }" @click="tab='quiz'">{{ t('workspace.tabQuiz') }}</button>
            <button class="text-tab" :class="{ active: tab==='keywords' }" @click="tab='keywords'">{{ t('workspace.tabKeywords') }}</button>
          </div>
          <StudySummary v-if="tab==='summary'" :content="corpus" />
          <FlashcardGenerator v-else-if="tab==='flashcards'" :content="corpus" />
          <QuizGenerator v-else-if="tab==='quiz'" :content="corpus" />
          <KeywordExtractor v-else :content="corpus" />
        </template>
      </section>

      <!-- Right: ask -->
      <aside class="ws-col ws-ask">
        <AskSourcesPanel :docs="selectedDocs" />
      </aside>
    </div>
  </div>
</template>
