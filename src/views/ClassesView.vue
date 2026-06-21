<script setup>
/**
 * ClassesView — the user's classes. Teachers see (and can create) the classes
 * they teach; everyone sees the classes they've joined. Joining happens on the
 * dedicated /join page.
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore.js'
import { useClassStore } from '../stores/classStore.js'
import AppSelect from '../components/common/AppSelect.vue'
import EmptyState from '../components/common/EmptyState.vue'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const classStore = useClassStore()

const showForm = ref(false)
const creating = ref(false)
const form = ref({ name: '', description: '', color: 'grad-blue' })

const colorOptions = [
  { value: 'grad-blue', label: t('mySubjects.colorBlue') },
  { value: 'grad-green', label: t('mySubjects.colorGreen') },
  { value: 'grad-fuchsia', label: t('mySubjects.colorFuchsia') },
  { value: 'grad-orange', label: t('mySubjects.colorOrange') }
]

onMounted(() => classStore.fetchAll())

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
function openForm() {
  form.value = { name: '', description: '', color: 'grad-blue' }
  showForm.value = true
}
async function create() {
  if (!form.value.name.trim()) return
  creating.value = true
  try {
    const row = await classStore.createClass({ ...form.value })
    showForm.value = false
    router.push({ name: 'class-detail', params: { id: row.id } })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div>
    <header class="page-head">
      <div>
        <h1 class="ph-title">{{ t('classes.title') }}</h1>
        <p class="ph-sub">{{ t('classes.sub') }}</p>
      </div>
      <div class="action-row">
        <router-link to="/join" class="btn btn-outline-soft"><i class="bi bi-box-arrow-in-right"></i>{{ t('classes.join') }}</router-link>
        <button v-if="auth.isTeacher" class="btn btn-brand" @click="openForm"><i class="bi bi-plus-lg"></i>{{ t('classes.new') }}</button>
      </div>
    </header>

    <!-- Teaching -->
    <section v-if="auth.isTeacher" class="class-section">
      <div class="section-head"><h3>{{ t('classes.teaching') }}</h3></div>
      <EmptyState v-if="!classStore.owned.length" icon="bi-easel2" :title="t('classes.noTeaching')" :message="t('classes.noTeachingMsg')">
        <button class="btn btn-brand empty-cta" @click="openForm"><i class="bi bi-plus-lg"></i>{{ t('classes.new') }}</button>
      </EmptyState>
      <div v-else class="row g-4">
        <div v-for="c in classStore.owned" :key="c.id" class="col-12 col-md-6 col-xl-4">
          <router-link :to="{ name: 'class-detail', params: { id: c.id } }" class="class-card">
            <span class="icon-tile class-badge" :class="c.color">{{ initials(c.name) }}</span>
            <div class="class-name">{{ c.name }}</div>
            <div class="class-desc">{{ c.description || t('classes.noDesc') }}</div>
            <div class="class-foot"><span class="badge-soft"><i class="bi bi-key"></i> {{ c.code }}</span></div>
          </router-link>
        </div>
      </div>
    </section>

    <!-- Enrolled -->
    <section class="class-section">
      <div class="section-head"><h3>{{ t('classes.enrolled') }}</h3></div>
      <EmptyState v-if="!classStore.enrolled.length" icon="bi-mortarboard" :title="t('classes.noEnrolled')" :message="t('classes.noEnrolledMsg')">
        <router-link to="/join" class="btn btn-brand empty-cta"><i class="bi bi-box-arrow-in-right"></i>{{ t('classes.join') }}</router-link>
      </EmptyState>
      <div v-else class="row g-4">
        <div v-for="c in classStore.enrolled" :key="c.id" class="col-12 col-md-6 col-xl-4">
          <router-link :to="{ name: 'class-detail', params: { id: c.id } }" class="class-card">
            <span class="icon-tile class-badge" :class="c.color">{{ initials(c.name) }}</span>
            <div class="class-name">{{ c.name }}</div>
            <div class="class-desc">{{ c.description || t('classes.noDesc') }}</div>
            <div class="class-foot"><span class="badge-soft"><i class="bi bi-key"></i> {{ c.code }}</span></div>
          </router-link>
        </div>
      </div>
    </section>

    <!-- Create class modal -->
    <div v-if="showForm" class="modal d-block" tabindex="-1" style="background: rgba(15,23,42,.5)">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ t('classes.modalTitle') }}</h5>
            <button class="btn-close" @click="showForm = false"></button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>{{ t('classes.name') }}</label>
              <input v-model="form.name" class="form-control" :placeholder="t('classes.namePlaceholder')" />
            </div>
            <div class="form-group">
              <label>{{ t('classes.color') }}</label>
              <AppSelect v-model="form.color" :options="colorOptions" :aria-label="t('classes.color')" />
            </div>
            <div class="form-group">
              <label>{{ t('classes.description') }}</label>
              <textarea v-model="form.description" class="form-control" rows="3" :placeholder="t('classes.descPlaceholder')"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-soft" @click="showForm = false">{{ t('common.cancel') }}</button>
            <button class="btn btn-brand" :disabled="creating || !form.name.trim()" @click="create">
              <span v-if="creating" class="spinner-border spinner-border-sm"></span>{{ t('classes.create') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
