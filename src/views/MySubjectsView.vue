<script setup>
/**
 * MySubjectsView — the user's personal subjects (workspaces). Lists subjects they
 * own and lets them create a new one (name, category, icon, colour, and whether
 * to share it to the community), then open it to add documents and generate
 * study material. Sharing can be toggled on each card afterwards. Catalog
 * browsing still lives in SubjectsView.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogStore } from '../stores/dialogStore.js'
import { useRouter } from 'vue-router'
import { useSubjectStore } from '../stores/subjectStore.js'
import { resizeImageToDataUrl } from '../utils/image.js'
import AppSelect from '../components/common/AppSelect.vue'
import EmptyState from '../components/common/EmptyState.vue'
import SubjectIcon from '../components/subjects/SubjectIcon.vue'

const { t } = useI18n()
const dialog = useDialogStore()
const router = useRouter()
const subjectStore = useSubjectStore()

const mine = computed(() => subjectStore.mySubjects)

const showForm = ref(false)
const creating = ref(false)
const iconError = ref('')

const OTHER = '__other__'
const emptyForm = () => ({
  name: '', description: '', color: 'grad-blue',
  categoryChoice: 'Personal', categoryCustom: '',
  icon: '', shared: false
})
const form = ref(emptyForm())

const colorOptions = [
  { value: 'grad-blue', label: t('mySubjects.colorBlue') },
  { value: 'grad-green', label: t('mySubjects.colorGreen') },
  { value: 'grad-fuchsia', label: t('mySubjects.colorFuchsia') },
  { value: 'grad-orange', label: t('mySubjects.colorOrange') }
]

// Category presets — the value is the (English) category used for filtering on
// the catalog; "Other…" reveals a free-text field so users aren't boxed in.
const categoryOptions = [
  { value: 'Personal', label: 'Personal' },
  { value: 'Computing', label: 'Computing' },
  { value: 'Mathematics', label: 'Mathematics' },
  { value: 'Business', label: 'Business' },
  { value: 'Science', label: 'Science' },
  { value: 'Languages', label: 'Languages' },
  { value: OTHER, label: t('mySubjects.categoryOther') }
]

// A small library of default subject icons to pick from.
const DEFAULT_ICONS = [
  'bi-book', 'bi-calculator', 'bi-code-slash', 'bi-braces', 'bi-graph-up-arrow',
  'bi-translate', 'bi-briefcase', 'bi-palette', 'bi-cpu', 'bi-globe2',
  'bi-lightbulb', 'bi-heart-pulse', 'bi-music-note-beamed', 'bi-rocket-takeoff', 'bi-mortarboard'
]

// Live preview of the tile as the user builds the subject.
const previewSubject = computed(() => ({
  color: form.value.color,
  icon: form.value.icon,
  name: form.value.name,
  letters: ((form.value.name || 'SUB').replace(/[^a-zA-Z]/g, '').slice(0, 3) || 'SUB').toUpperCase()
}))

onMounted(() => {
  if (!subjectStore.subjects.length) subjectStore.fetchSubjects()
})

function openForm() {
  form.value = emptyForm()
  iconError.value = ''
  showForm.value = true
}

function pickIcon(icon) {
  form.value.icon = form.value.icon === icon ? '' : icon
}

async function onIconUpload(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // let the same file be re-selected later
  if (!file) return
  iconError.value = ''
  if (file.size > 3 * 1024 * 1024) { iconError.value = t('mySubjects.iconTooBig'); return }
  try {
    form.value.icon = await resizeImageToDataUrl(file, 128)
  } catch {
    iconError.value = t('mySubjects.iconFailed')
  }
}

async function create() {
  if (!form.value.name.trim()) return
  const category = form.value.categoryChoice === OTHER
    ? (form.value.categoryCustom.trim() || 'Personal')
    : form.value.categoryChoice
  creating.value = true
  try {
    const row = await subjectStore.createSubject({
      name: form.value.name,
      description: form.value.description,
      category,
      color: form.value.color,
      icon: form.value.icon || null,
      shared: form.value.shared
    })
    showForm.value = false
    router.push({ name: 'subject-workspace', params: { id: row.id } })
  } finally {
    creating.value = false
  }
}

async function toggleShare(s) {
  const next = s.visibility !== 'public'
  try {
    await subjectStore.setShared(s.id, next)
    dialog.toast(next ? t('mySubjects.nowShared') : t('mySubjects.nowPrivate'), 'success')
  } catch {
    dialog.toast(t('mySubjects.shareFailed'), 'error')
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
          <div class="ws-card-actions">
            <button
              class="ws-icon-btn"
              :class="{ shared: s.visibility === 'public' }"
              :title="s.visibility === 'public' ? t('mySubjects.nowShared') : t('mySubjects.makeShared')"
              :aria-label="t('mySubjects.share')"
              @click="toggleShare(s)"
            >
              <i class="bi" :class="s.visibility === 'public' ? 'bi-globe2' : 'bi-lock'"></i>
            </button>
            <button class="ws-icon-btn danger" :aria-label="t('common.delete')" @click="remove(s.id)"><i class="bi bi-trash"></i></button>
          </div>
          <router-link :to="{ name: 'subject-workspace', params: { id: s.id } }" class="ws-card-link">
            <SubjectIcon :subject="s" />
            <div class="sc-code">{{ s.code }} · {{ s.category }}</div>
            <div class="sc-name">{{ s.name }}</div>
            <div class="sc-row">
              <span class="sc-notes"><i class="bi bi-file-earmark-text"></i> {{ t('mySubjects.openWorkspace') }}</span>
              <span class="badge-soft sub-share-badge">
                <i class="bi" :class="s.visibility === 'public' ? 'bi-globe2' : 'bi-lock'"></i>
                {{ s.visibility === 'public' ? t('mySubjects.sharedBadge') : t('mySubjects.privateBadge') }}
              </span>
            </div>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Create subject modal -->
    <div v-if="showForm" class="modal d-block" tabindex="-1" style="background: rgba(15,23,42,.5)" @click.self="showForm = false">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ t('mySubjects.modalTitle') }}</h5>
            <button class="btn-close" @click="showForm = false"></button>
          </div>
          <div class="modal-body subject-form-body">
            <!-- Live preview -->
            <div class="subject-preview">
              <SubjectIcon :subject="previewSubject" />
              <div class="subject-preview-meta">
                <div class="sp-preview-name">{{ form.name.trim() || t('mySubjects.namePlaceholder') }}</div>
                <div class="sp-preview-cat">{{ form.categoryChoice === OTHER ? (form.categoryCustom.trim() || t('mySubjects.categoryOther')) : form.categoryChoice }}</div>
              </div>
            </div>

            <div class="form-group">
              <label>{{ t('mySubjects.name') }}</label>
              <input v-model="form.name" class="form-control" :placeholder="t('mySubjects.namePlaceholder')" />
            </div>

            <div class="form-group">
              <label>{{ t('mySubjects.category') }}</label>
              <AppSelect v-model="form.categoryChoice" :options="categoryOptions" :aria-label="t('mySubjects.category')" />
              <input
                v-if="form.categoryChoice === OTHER"
                v-model="form.categoryCustom"
                class="form-control mt-2"
                :placeholder="t('mySubjects.categoryCustomPlaceholder')"
              />
            </div>

            <!-- Icon picker -->
            <div class="form-group">
              <label>{{ t('mySubjects.icon') }}</label>
              <div class="icon-picker">
                <button
                  type="button"
                  class="icon-choice"
                  :class="{ active: !form.icon }"
                  :title="t('mySubjects.iconLetters')"
                  @click="form.icon = ''"
                ><span class="ic-letters">{{ previewSubject.letters }}</span></button>
                <button
                  v-for="ic in DEFAULT_ICONS"
                  :key="ic"
                  type="button"
                  class="icon-choice"
                  :class="{ active: form.icon === ic }"
                  @click="pickIcon(ic)"
                ><i class="bi" :class="ic"></i></button>
                <label class="icon-choice icon-upload" :title="t('mySubjects.iconUpload')">
                  <i class="bi bi-upload"></i>
                  <input type="file" accept="image/*" hidden @change="onIconUpload" />
                </label>
              </div>
              <p v-if="iconError" class="field-error">{{ iconError }}</p>
            </div>

            <!-- Colour swatches -->
            <div class="form-group">
              <label>{{ t('mySubjects.color') }}</label>
              <div class="color-swatches">
                <button
                  v-for="c in colorOptions"
                  :key="c.value"
                  type="button"
                  class="color-swatch icon-tile"
                  :class="[c.value, { active: form.color === c.value }]"
                  :title="c.label"
                  :aria-label="c.label"
                  @click="form.color = c.value"
                ><i v-if="form.color === c.value" class="bi bi-check-lg"></i></button>
              </div>
            </div>

            <!-- Share toggle -->
            <div class="form-group">
              <div class="sub-share-toggle">
                <div class="sub-share-toggle-text">
                  <div class="sub-share-toggle-label"><i class="bi bi-globe2"></i>{{ t('mySubjects.share') }}</div>
                  <div class="sub-share-toggle-hint">{{ t('mySubjects.shareHint') }}</div>
                </div>
                <button
                  type="button"
                  class="sub-switch"
                  :class="{ on: form.shared }"
                  role="switch"
                  :aria-checked="form.shared"
                  @click="form.shared = !form.shared"
                ><span class="sub-switch-knob"></span></button>
              </div>
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

<style scoped>
.subject-form-body { max-height: 68vh; overflow-y: auto; }

/* Live preview */
.subject-preview {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3); margin-bottom: var(--space-3);
  background: var(--c-surface-2); border: 1px solid var(--c-border); border-radius: var(--radius);
}
/* The tile's size normally comes from a .subject-card ancestor; the preview has
   none, so size it here. */
.subject-preview :deep(.icon-tile) { width: 52px; height: 52px; font-size: 1rem; }
.sp-preview-name { font-weight: 700; }
.sp-preview-cat { color: var(--c-text-muted); font-size: 0.82rem; }

/* Icon picker */
.icon-picker { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.icon-choice {
  width: 40px; height: 40px; border-radius: 10px;
  display: grid; place-items: center; font-size: 1.05rem;
  background: var(--c-surface-2); border: 1px solid var(--c-border);
  color: var(--c-text); cursor: pointer; transition: border-color .15s, transform .1s;
}
.icon-choice:hover { transform: translateY(-1px); }
.icon-choice.active { border-color: var(--c-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--c-primary) 30%, transparent); }
.icon-choice .ic-letters { font-size: 0.72rem; font-weight: 800; }
.icon-upload { color: var(--c-text-muted); }

/* Colour swatches */
.color-swatches { display: flex; gap: var(--space-2); }
.color-swatch {
  width: 40px; height: 40px; border-radius: 10px; cursor: pointer;
  display: grid; place-items: center; color: #fff; border: 2px solid transparent;
}
.color-swatch.active { border-color: var(--c-text); }

/* Share toggle (uniquely named so it can't clash with the global .switch) */
.sub-share-toggle {
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
  padding: var(--space-3); background: var(--c-surface-2);
  border: 1px solid var(--c-border); border-radius: var(--radius);
}
.sub-share-toggle-label { font-weight: 600; display: flex; align-items: center; gap: 0.4rem; }
.sub-share-toggle-hint { color: var(--c-text-muted); font-size: 0.8rem; margin-top: 0.15rem; }
.sub-switch {
  flex-shrink: 0; width: 44px; height: 26px; border-radius: 999px; padding: 3px;
  background: var(--c-border); border: none; cursor: pointer; transition: background .15s;
  box-sizing: border-box; display: flex; align-items: center;
}
.sub-switch.on { background: var(--c-primary); }
.sub-switch-knob {
  display: block; width: 20px; height: 20px; border-radius: 50%; background: #fff;
  transition: transform .15s;
}
.sub-switch.on .sub-switch-knob { transform: translateX(18px); }

.field-error { color: var(--c-danger, #ef4444); font-size: 0.8rem; margin: 0.4rem 0 0; }

/* Card action buttons (share + delete) */
.ws-card-actions { position: absolute; top: var(--space-3); right: var(--space-3); display: flex; gap: 0.35rem; z-index: 2; }
.ws-icon-btn {
  width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center;
  background: var(--c-surface-2); border: 1px solid var(--c-border); color: var(--c-text-muted); cursor: pointer;
}
.ws-icon-btn:hover { color: var(--c-text); }
.ws-icon-btn.shared { color: var(--c-primary); border-color: var(--c-primary); }
.ws-icon-btn.danger:hover { color: var(--c-danger, #ef4444); border-color: var(--c-danger, #ef4444); }
.sub-share-badge { display: inline-flex; align-items: center; gap: 0.3rem; }
</style>
