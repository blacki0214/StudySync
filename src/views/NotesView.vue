<script setup>
/**
 * NotesView — searchable, filterable, sortable list of notes with a "new note"
 * modal. Reads ?subject= and ?q= query params so links from other pages can
 * pre-filter the list.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDialogStore } from '../stores/dialogStore.js'
import { useNoteStore } from '../stores/noteStore.js'
import { useSubjectStore } from '../stores/subjectStore.js'
import NoteCard from '../components/notes/NoteCard.vue'
import NoteSearchFilter from '../components/notes/NoteSearchFilter.vue'
import AppSelect from '../components/common/AppSelect.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'
import EmptyState from '../components/common/EmptyState.vue'

const route = useRoute()
const { t } = useI18n()
const dialog = useDialogStore()
const noteStore = useNoteStore()
const subjectStore = useSubjectStore()

const search = ref(route.query.q || '')
const subjectId = ref(route.query.subject || '')
const sort = ref('recent')

// New-note form state.
const showForm = ref(false)
const form = ref({ title: '', content: '', subject_id: '' })
const creating = ref(false)

// Delete-confirmation state.
const pendingDelete = ref(null)
const deleting = ref(false)
function askDelete(note) { pendingDelete.value = note }
async function confirmDelete() {
  if (!pendingDelete.value) return
  deleting.value = true
  try {
    await noteStore.deleteNote(pendingDelete.value.id)
    pendingDelete.value = null
  } catch {
    dialog.toast(t('notes.deleteFailed'), 'error')
  } finally {
    deleting.value = false
  }
}

onMounted(async () => {
  await Promise.all([subjectStore.fetchSubjects(), noteStore.fetchNotes()])
  // Arriving from a subject with ?new=1 opens the create form pre-scoped to it.
  if (route.query.new) openForm()
})

// Keep the filter in sync if the route query changes (e.g. navbar search).
watch(() => route.query, (q) => {
  if (q.q !== undefined) search.value = q.q
  if (q.subject !== undefined) subjectId.value = q.subject
})

const subjectCode = (id) => subjectStore.getById(id)?.code || ''

// A note can belong to a subject or none — offer an explicit "No subject" option.
const subjectOptions = computed(() => [
  { value: '', label: t('notes.noSubject') },
  ...subjectStore.subjects.map((s) => ({ value: s.id, label: `${s.code} · ${s.name}` }))
])

const filtered = computed(() => {
  let list = [...noteStore.notes]
  if (subjectId.value) list = list.filter((n) => n.subject_id === subjectId.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    )
  }
  if (sort.value === 'likes') list.sort((a, b) => b.likes_count - a.likes_count)
  else if (sort.value === 'title') list.sort((a, b) => a.title.localeCompare(b.title))
  else list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  return list
})

function openForm() {
  // Default to the active subject filter (if any); otherwise no subject.
  form.value = { title: '', content: '', subject_id: subjectId.value || '' }
  showForm.value = true
}

async function createNote() {
  if (!form.value.title.trim()) return // subject is optional now
  creating.value = true
  try {
    await noteStore.createNote({
      subjectId: form.value.subject_id || null,
      title: form.value.title.trim(),
      content: form.value.content.trim()
    })
    showForm.value = false
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div>
    <header class="page-head">
      <div>
        <h1 class="ph-title">{{ t('notes.title') }}</h1>
        <p class="ph-sub">{{ t('notes.sub') }}</p>
      </div>
      <button class="btn btn-brand" @click="openForm"><i class="bi bi-plus-lg"></i>{{ t('notes.newNote') }}</button>
    </header>

    <NoteSearchFilter
      v-model:search="search"
      v-model:subjectId="subjectId"
      v-model:sort="sort"
      :subjects="subjectStore.subjects"
    />

    <LoadingSpinner v-if="noteStore.loading" />

    <EmptyState
      v-else-if="!filtered.length"
      icon="bi-sticky"
      :title="t('notes.emptyTitle')"
      :message="t('notes.emptyMsg')"
    >
      <button class="btn btn-brand empty-cta" @click="openForm"><i class="bi bi-plus-lg"></i>{{ t('notes.createNote') }}</button>
    </EmptyState>

    <div v-else class="row g-4">
      <div v-for="n in filtered" :key="n.id" class="col-12 col-md-6 col-lg-4">
        <NoteCard :note="n" :subject-code="subjectCode(n.subject_id)" deletable @delete="askDelete" />
      </div>
    </div>

    <!-- New note modal (Bootstrap-styled, controlled by showForm) -->
    <div v-if="showForm" class="modal d-block" tabindex="-1" style="background: rgba(15,23,42,.5)">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ t('notes.modalTitle') }}</h5>
            <button class="btn-close" @click="showForm = false"></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>{{ t('notes.subject') }}</label>
              <AppSelect v-model="form.subject_id" :options="subjectOptions" :placeholder="t('notes.subject')" :aria-label="t('notes.subject')" />
            </div>
            <div class="form-group">
              <label>{{ t('notes.titleField') }}</label>
              <input v-model="form.title" class="form-control" :placeholder="t('notes.titlePlaceholder')" />
            </div>
            <div class="form-group">
              <label>{{ t('notes.content') }}</label>
              <textarea v-model="form.content" class="form-control" rows="5"
                :placeholder="t('notes.contentPlaceholder')"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-soft" @click="showForm = false">{{ t('common.cancel') }}</button>
            <button class="btn btn-brand" :disabled="creating" @click="createNote">
              <span v-if="creating" class="spinner-border spinner-border-sm"></span>{{ t('notes.createContinue') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirmation -->
    <div v-if="pendingDelete" class="modal d-block" tabindex="-1" style="background: rgba(15,23,42,.5)" @click.self="pendingDelete = null">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-exclamation-triangle text-danger me-2"></i>{{ t('notes.deleteTitle') }}</h5>
            <button class="btn-close" @click="pendingDelete = null"></button>
          </div>
          <div class="modal-body">
            <p class="mb-0">{{ t('notes.deleteConfirm', { title: pendingDelete.title }) }}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-soft" @click="pendingDelete = null">{{ t('common.cancel') }}</button>
            <button class="btn btn-danger" :disabled="deleting" @click="confirmDelete">
              <span v-if="deleting" class="spinner-border spinner-border-sm me-1"></span>{{ t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
