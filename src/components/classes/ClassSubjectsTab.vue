<script setup>
/**
 * ClassSubjectsTab — subjects that belong to a class workspace (Phase 2). The
 * teacher / TA creates them to organise class material by topic; every member
 * can open one. Class subjects never appear in the personal subject catalog
 * (subjectService filters class_id).
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/authStore.js'
import { useDialogStore } from '../../stores/dialogStore.js'
import { subjectService } from '../../services/subjectService.js'
import EmptyState from '../common/EmptyState.vue'

const props = defineProps({
  classId: { type: String, required: true },
  canManage: { type: Boolean, default: false }
})
const { t } = useI18n()
const auth = useAuthStore()
const dialog = useDialogStore()

const subjects = ref([])
const creating = ref(false)

onMounted(load)
async function load() {
  subjects.value = await subjectService.listByClass(props.classId)
}
async function create() {
  const name = await dialog.promptText({
    title: t('classes.newSubject'),
    label: t('subjects.name'),
    placeholder: t('subjects.namePlaceholder')
  })
  if (!name || !name.trim()) return
  creating.value = true
  try {
    const row = await subjectService.createSubject({
      name: name.trim(),
      category: 'Class',
      ownerId: auth.user?.id,
      classId: props.classId
    })
    subjects.value.unshift(row)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div>
    <div v-if="canManage" class="tab-toolbar">
      <button class="btn btn-brand btn-sm" :disabled="creating" @click="create"><i class="bi bi-plus-lg"></i>{{ t('classes.newSubject') }}</button>
    </div>

    <EmptyState v-if="!subjects.length" icon="bi-journal-bookmark" :title="t('classes.noSubjects')" />
    <div v-else class="row g-4">
      <div v-for="s in subjects" :key="s.id" class="col-12 col-md-6 col-xl-4">
        <router-link :to="{ name: 'subject-hub', params: { id: s.id } }" class="class-card">
          <span class="icon-tile class-badge" :class="s.color">{{ s.letters }}</span>
          <div class="class-name">{{ s.name }}</div>
          <div class="class-desc">{{ s.description || t('classes.noDesc') }}</div>
          <div class="class-foot"><span class="badge-soft">{{ s.code }}</span></div>
        </router-link>
      </div>
    </div>
  </div>
</template>
