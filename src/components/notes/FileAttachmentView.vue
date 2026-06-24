<script setup>
/**
 * FileAttachmentView — compact chip for an attached file (the FileAttachment
 * node). Shows a small thumbnail for images, otherwise a file-type icon, plus
 * the file name and size. Clicking opens / downloads the file.
 */
import { computed } from 'vue'
import { NodeViewWrapper } from '@tiptap/vue-3'

const props = defineProps({
  node: { type: Object, required: true },
  editor: { type: Object, required: true },
  deleteNode: { type: Function, required: true },
  selected: { type: Boolean, default: false }
})

const href = computed(() => props.node.attrs.href || '')
const name = computed(() => props.node.attrs.name || 'file')
const mime = computed(() => props.node.attrs.mime || '')
const size = computed(() => Number(props.node.attrs.size) || 0)
const editable = computed(() => props.editor?.isEditable)

const ext = computed(() => (name.value.split('.').pop() || '').toLowerCase())
const isImage = computed(() => mime.value.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext.value))

// Map a file type to a Bootstrap icon + an accent colour class.
const kind = computed(() => {
  const e = ext.value
  if (isImage.value) return { icon: 'bi-file-earmark-image', cls: 'k-image', label: 'Image' }
  if (e === 'pdf') return { icon: 'bi-file-earmark-pdf', cls: 'k-pdf', label: 'PDF' }
  if (['doc', 'docx', 'rtf', 'odt'].includes(e)) return { icon: 'bi-file-earmark-word', cls: 'k-word', label: 'Word' }
  if (['xls', 'xlsx', 'csv', 'ods'].includes(e)) return { icon: 'bi-file-earmark-excel', cls: 'k-excel', label: 'Spreadsheet' }
  if (['ppt', 'pptx', 'odp'].includes(e)) return { icon: 'bi-file-earmark-ppt', cls: 'k-ppt', label: 'Slides' }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return { icon: 'bi-file-earmark-zip', cls: 'k-zip', label: 'Archive' }
  if (['txt', 'md', 'json', 'xml', 'log'].includes(e)) return { icon: 'bi-file-earmark-text', cls: 'k-text', label: 'Text' }
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(e)) return { icon: 'bi-file-earmark-music', cls: 'k-audio', label: 'Audio' }
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(e)) return { icon: 'bi-file-earmark-play', cls: 'k-video', label: 'Video' }
  return { icon: 'bi-file-earmark', cls: 'k-generic', label: (e || 'File').toUpperCase() }
})

const prettySize = computed(() => {
  const b = size.value
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
})
</script>

<template>
  <node-view-wrapper as="span" class="file-chip" :class="{ 'file-chip-sel': selected }" contenteditable="false">
    <a class="file-chip-link" :href="href" :download="name" target="_blank" rel="noopener" :title="name">
      <span v-if="isImage && href" class="file-chip-thumb"><img :src="href" :alt="name" /></span>
      <span v-else class="file-chip-ico" :class="kind.cls"><i class="bi" :class="kind.icon"></i></span>
      <span class="file-chip-body">
        <span class="file-chip-name">{{ name }}</span>
        <span class="file-chip-meta">{{ kind.label }}<template v-if="prettySize"> · {{ prettySize }}</template></span>
      </span>
    </a>
    <button v-if="editable" class="file-chip-del" type="button" title="Remove" @click="deleteNode()"><i class="bi bi-x"></i></button>
  </node-view-wrapper>
</template>
