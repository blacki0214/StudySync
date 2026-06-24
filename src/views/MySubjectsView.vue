<script setup>
/**
 * MySubjectsView — the user's personal subjects (workspaces). Lists subjects they
 * own and lets them create a new one, then open it to add documents and generate
 * study material. Catalog browsing still lives in SubjectsView.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogStore } from '../stores/dialogStore.js'
import { useRouter } from 'vue-router'
import { useSubjectStore } from '../stores/subjectStore.js'
import AppSelect from '../components/common/AppSelect.vue'
import EmptyState from '../components/common/EmptyState.vue'

const { t } = useI18n()
const dialog = useDialogStore()
const router = useRouter()
const subjectStore = useSubjectStore()

const mine = computed(() => subjectStore.mySubjects)

const showForm = ref(false)
const creating = ref(false)
const form = ref({ name: '', description: '', category: 'Personal', color: 'grad-blue' })

const colorOptions = [
  { value: 'grad-blue', label: t('mySubjects.colorBlue') },
  { value: 'grad-green', label: t('mySubjects.colorGreen') },
  { value: 'grad-fuchsia', label: t('mySubjects.colorFuchsia') },
  { value: 'grad-orange', label: t('mySubjects.colorOrange') }
]

onMounted(() => {
  if (!subjectStore.subjects.length) subjectStore.fetchSubjects()
})

function openForm() {
  form.value = { name: '', description: '', category: 'Personal', color: 'grad-blue' }
  showForm.value = true
}

async function create() {
  if (!form.value.name.trim()) return
  creating.value = true
  try {
    const row = await subjectStore.createSubject({ ...form.value })
    showForm.value = false
    router.push({ name: 'subject-workspace', params: { id: row.id } })
  } finally {
    creating.value = false
  }
}

async function remove(id) {
  if (await dialog.confirm({ message: t('mySubjects.confirmDelete'), danger: true, confirmText: t('common.delete') })) {
    await subjectStore.deleteSubject(id)
  }
}
</script>

<template>
  <div>
    <header class="page-head">
      <div>
        <h1 class="ph-title">{{ t('mySubjects.title') }}</h1>
        <p class="ph-sub">{{ t('mySubjects.sub') }}</p>
      </div>
      <button class="btn btn-brand" @click="openForm"><i class="bi bi-plus-lg"></i>{{ t('mySubjects.new') }}</button>
    </header>

    <EmptyState
      v-if="!mine.length"
      icon="bi-folder-plus"
      :title="t('mySubjects.emptyTitle')"
      :message="t('mySubjects.emptyMsg')"
    >
      <button class="btn btn-brand empty-cta" @click="openForm"><i class="bi bi-plus-lg"></i>{{ t('mySubjects.create') }}</button>
    </EmptyState>

    <div v-else class="row g-4">
      <div v-for="s in mine" :key="s.id" class="col-12 col-md-6 col-xl-3">
        <div class="subject-card workspace-card">
          <button class="ws-delete" :aria-label="t('common.cancel')" @click="remove(s.id)"><i class="bi bi-trash"></i></button>
          <router-link :to="{ name: 'subject-workspace', params: { id: s.id } }" class="ws-card-link">
            <span class="icon-tile sc-badge" :class="s.color">{{ s.letters }}</span>
            <div class="sc-code">{{ s.code }} · {{ s.category }}</div>
            <div class="sc-name">{{ s.name }}</div>
            <div class="sc-row">
              <span class="sc-notes"><i class="bi bi-file-earmark-text"></i> {{ t('mySubjects.openWorkspace') }}</span>
            </div>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Create subject modal -->
    <div v-if="showForm" class="modal d-block" tabindex="-1" style="background: rgba(15,23,42,.5)">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ t('mySubjects.modalTitle') }}</h5>
            <button class="btn-close" @click="showForm = false"></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>{{ t('mySubjects.name') }}</label>
              <input v-model="form.name" class="form-control" :placeholder="t('mySubjects.namePlaceholder')" />
            </div>
            <div class="form-group">
              <label>{{ t('mySubjects.category') }}</label>
              <input v-model="form.category" class="form-control" :placeholder="t('mySubjects.categoryPlaceholder')" />
            </div>
            <div class="form-group">
              <label>{{ t('mySubjects.color') }}</label>
              <AppSelect v-model="form.color" :options="colorOptions" :aria-label="t('mySubjects.color')" />
            </div>
            <div class="form-group">
              <label>{{ t('mySubjects.description') }}</label>
              <textarea v-model="form.description" class="form-control" rows="3" :placeholder="t('mySubjects.descPlaceholder')"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-soft" @click="showForm = false">{{ t('common.cancel') }}</button>
            <button class="btn btn-brand" :disabled="creating || !form.name.trim()" @click="create">
              <span v-if="creating" class="spinner-border spinner-border-sm"></span>{{ t('mySubjects.create') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
