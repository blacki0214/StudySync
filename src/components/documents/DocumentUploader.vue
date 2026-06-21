<script setup>
/**
 * DocumentUploader — add a source to a subject workspace. Three tabs:
 *   • Paste  — title + pasted text
 *   • Upload — .pdf/.txt/.md file; text is extracted in-browser (pdf.js)
 *   • Link   — a URL plus pasted text (no server fetch, so we keep it honest)
 * Emits `add` with { title, sourceType, sourceUrl, text, file }.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { extractFromFile, ACCEPTED_TYPES } from '../../utils/documentExtractor.js'

const { t } = useI18n()
const emit = defineEmits(['add'])
defineProps({ busy: { type: Boolean, default: false } })

const tab = ref('paste')
const title = ref('')
const text = ref('')
const url = ref('')
const fileName = ref('')
const pickedFile = ref(null)
const extracting = ref(false)
const error = ref('')

async function onFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  error.value = ''
  fileName.value = file.name
  pickedFile.value = file
  extracting.value = true
  try {
    const { text: extracted } = await extractFromFile(file)
    text.value = extracted
    if (!title.value) title.value = file.name.replace(/\.[^.]+$/, '')
  } catch (err) {
    error.value = t('workspace.extractFailed')
  } finally {
    extracting.value = false
  }
}

function submit() {
  if (extracting.value) return
  const payload = { title: title.value.trim(), text: text.value.trim() }
  if (tab.value === 'paste') {
    if (!payload.text) return
    payload.sourceType = 'text'
    payload.title = payload.title || t('workspace.pastedSource')
  } else if (tab.value === 'file') {
    if (!payload.text) return
    payload.sourceType = pickedFile.value && /\.pdf$/i.test(pickedFile.value.name) ? 'pdf' : 'file'
    payload.title = payload.title || fileName.value
    payload.file = pickedFile.value
  } else {
    if (!url.value.trim()) return
    payload.sourceType = 'link'
    payload.sourceUrl = url.value.trim()
    payload.title = payload.title || url.value.trim()
  }
  emit('add', payload)
  reset()
}

function reset() {
  title.value = ''
  text.value = ''
  url.value = ''
  fileName.value = ''
  pickedFile.value = null
  error.value = ''
}
</script>

<template>
  <div class="uploader panel">
    <div class="section-title"><i class="bi bi-plus-circle"></i>{{ t('workspace.addSource') }}</div>

    <div class="text-tabs uploader-tabs">
      <button class="text-tab" :class="{ active: tab === 'paste' }" @click="tab = 'paste'">{{ t('workspace.tabPaste') }}</button>
      <button class="text-tab" :class="{ active: tab === 'file' }" @click="tab = 'file'">{{ t('workspace.tabUpload') }}</button>
      <button class="text-tab" :class="{ active: tab === 'link' }" @click="tab = 'link'">{{ t('workspace.tabLink') }}</button>
    </div>

    <div class="form-group">
      <input v-model="title" class="form-control" :placeholder="t('workspace.sourceTitle')" />
    </div>

    <!-- Paste -->
    <div v-if="tab === 'paste'" class="form-group">
      <textarea v-model="text" class="form-control" rows="5" :placeholder="t('workspace.pastePlaceholder')"></textarea>
    </div>

    <!-- Upload -->
    <div v-else-if="tab === 'file'" class="form-group">
      <label class="file-drop">
        <input type="file" :accept="ACCEPTED_TYPES" class="file-input" @change="onFile" />
        <i class="bi bi-cloud-arrow-up"></i>
        <span>{{ fileName || t('workspace.chooseFile') }}</span>
      </label>
      <div v-if="extracting" class="ws-extracting"><span class="spinner-border spinner-border-sm"></span>{{ t('workspace.extracting') }}</div>
      <div v-else-if="text" class="ws-extracted">{{ t('workspace.extractedChars', { n: text.length }) }}</div>
    </div>

    <!-- Link -->
    <div v-else class="form-group">
      <input v-model="url" class="form-control ws-url" :placeholder="t('workspace.linkPlaceholder')" />
      <textarea v-model="text" class="form-control" rows="4" :placeholder="t('workspace.linkTextPlaceholder')"></textarea>
    </div>

    <p v-if="error" class="form-error"><i class="bi bi-exclamation-circle"></i>{{ error }}</p>

    <button class="btn btn-brand w-100" :disabled="busy || extracting" @click="submit">
      <span v-if="busy" class="spinner-border spinner-border-sm"></span>
      <i v-else class="bi bi-plus-lg"></i>{{ t('workspace.addSource') }}
    </button>
  </div>
</template>
