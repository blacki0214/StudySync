<script setup>
/**
 * ClassDocumentsTab — documents shared with the class. Any member can add a
 * source (paste/upload/link); the existing DocumentUploader handles extraction.
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { documentService } from '../../services/documentService.js'
import { useAuthStore } from '../../stores/authStore.js'
import { timeAgo } from '../../utils/formatDate.js'
import DocumentUploader from '../documents/DocumentUploader.vue'
import EmptyState from '../common/EmptyState.vue'

const props = defineProps({ classId: { type: String, required: true } })
const { t } = useI18n()
const auth = useAuthStore()

const docs = ref([])
const busy = ref(false)
const showUploader = ref(false)
const ICONS = { pdf: 'bi-file-earmark-pdf', file: 'bi-file-earmark-text', link: 'bi-link-45deg', text: 'bi-fonts' }

onMounted(async () => { docs.value = await documentService.listByClass(props.classId) })

async function add(payload) {
  busy.value = true
  try {
    const row = await documentService.createDocument({ classId: props.classId, ownerId: auth.user?.id, ...payload })
    docs.value.unshift(row)
    showUploader.value = false
  } finally {
    busy.value = false
  }
}
async function remove(doc) {
  await documentService.deleteDocument(doc)
  docs.value = docs.value.filter((d) => d.id !== doc.id)
}
</script>

<template>
  <div>
    <div class="tab-toolbar">
      <button class="btn btn-brand btn-sm" @click="showUploader = !showUploader"><i class="bi bi-plus-lg"></i>{{ t('workspace.addSource') }}</button>
    </div>

    <DocumentUploader v-if="showUploader" :busy="busy" @add="add" />

    <EmptyState v-if="!docs.length" icon="bi-collection" :title="t('classes.noDocuments')" />
    <div v-else class="panel roster">
      <div v-for="d in docs" :key="d.id" class="roster-row class-list-row">
        <span class="doc-icon"><i class="bi" :class="ICONS[d.source_type] || 'bi-file-earmark'"></i></span>
        <div class="doc-main">
          <div class="doc-title">{{ d.title }}</div>
          <div class="doc-meta">{{ t('workspace.charsN', { n: d.char_count || 0 }) }} · {{ timeAgo(d.created_at) }}</div>
        </div>
        <span class="roster-spacer"></span>
        <button v-if="d.owner_id === auth.user?.id" class="doc-remove" @click="remove(d)"><i class="bi bi-trash"></i></button>
      </div>
    </div>
  </div>
</template>
