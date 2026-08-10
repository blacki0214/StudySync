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
import Pagination from '../components/common/Pagination.vue'

const route = useRoute()
const { t } = useI18n()
const dialog = useDialogStore()
const noteStore = useNoteStore()
const subjectStore = useSubjectStore()

const search = ref(route.query.q || '')
const subjectId = ref(route.query.subject || '')
const sort = ref('recent')

// Which set of notes to show: the ones I wrote, or the ones opened via someone
// else's share link. They are two different lists because opening a share link
// never transfers ownership — see noteStore.sharedNotes.
const scope = ref('mine') // 'mine' | 'shared'

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
  let list = scope.value === 'shared' ? [...noteStore.sharedNotes] : [...noteStore.notes]
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

// --- Pagination ------------------------------------------------------------
// The grid is 3 columns on desktop, so a multiple of 3 always fills its rows.
const PER_PAGE = 9
const page = ref(1)

/** The slice actually rendered. `filtered` stays the full result set so the
 *  pager can report an honest total. */
const paged = computed(() => filtered.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE))

// Any change to the query resets to page 1 — otherwise a search that returns
// two notes while the user sits on page 4 renders an empty grid.
watch([search, subjectId, sort, scope], () => { page.value = 1 })

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

    <!-- Scope pills. "Shared with me" only appears once there is something in
         it, so an account that has never opened a share link is not shown an
         empty tab it can do nothing about. -->
    <div v-if="noteStore.sharedNotes.length" class="filter-pills">
      <button class="fp" :class="{ active: scope === 'mine' }" @click="scope = 'mine'">
        <i class="bi bi-person"></i>{{ t('notes.scopeMine') }}
      </button>
      <button class="fp" :class="{ active: scope === 'shared' }" @click="scope = 'shared'">
        <i class="bi bi-people"></i>{{ t('notes.scopeShared') }}
        <span class="fp-count">{{ noteStore.sharedNotes.length }}</span>
      </button>
    </div>

    <NoteSearchFilter
      v-model:search="search"
      v-model:subjectId="subjectId"
      v-model:sort="sort"
      :subjects="subjectStore.subjects"
    />

    <LoadingSpinner v-if="noteStore.loading" />

    <EmptyState
      v-else-if="!filtered.length"
      :icon="scope === 'shared' ? 'bi-people' : 'bi-sticky'"
      :title="scope === 'shared' ? t('notes.sharedEmptyTitle') : t('notes.emptyTitle')"
      :message="scope === 'shared' ? t('notes.sharedEmptyMsg') : t('notes.emptyMsg')"
    >
      <!-- No "create" CTA on the shared tab: you cannot create someone else's
           note, the only way in is opening their link. -->
      <button v-if="scope === 'mine'" class="btn btn-brand empty-cta" @click="openForm"><i class="bi bi-plus-lg"></i>{{ t('notes.createNote') }}</button>
    </EmptyState>

    <template v-else>
      <div class="row g-4">
        <div v-for="n in paged" :key="n.id" class="col-12 col-md-6 col-lg-4">
          <!-- Shared notes belong to someone else: no delete affordance. -->
          <NoteCard
            :note="n"
            :subject-code="subjectCode(n.subject_id)"
            :highlight="search"
            :deletable="scope === 'mine'"
            :shared-badge="scope === 'shared' ? (n.shared_permission || 'read') : ''"
            @delete="askDelete"
          />
        </div>
      </div>

      <Pagination v-model="page" :total="filtered.length" :per-page="PER_PAGE" />
    </template>

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
