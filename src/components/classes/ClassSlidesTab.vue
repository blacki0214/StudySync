<script setup>
/**
 * ClassSlidesTab — a class's slide decks (Phase 3, upload model). Teacher/TA
 * uploads a PDF or PowerPoint; anyone can present it. PDFs present fullscreen
 * in-app (pdf.js); PPTX can be downloaded.
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/authStore.js'
import { useDialogStore } from '../../stores/dialogStore.js'
import { slideService } from '../../services/slideService.js'
import EmptyState from '../common/EmptyState.vue'
import SlidePresenter from './SlidePresenter.vue'

const props = defineProps({
  classId: { type: String, required: true },
  canManage: { type: Boolean, default: false }
})
const { t } = useI18n()
const auth = useAuthStore()
const dialog = useDialogStore()

const decks = ref([])
const uploading = ref(false)
const fileInput = ref(null)
const presenting = ref(null) // the deck being presented

onMounted(async () => { decks.value = await slideService.listDecks(props.classId) })

function isPdf(d) {
  return (d.file_type || '').toLowerCase().includes('pdf') || (d.file_url || '').toLowerCase().includes('.pdf')
}
function pick() { fileInput.value?.click() }

async function onFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  const okType = /\.(pdf|pptx?|)$/i.test(file.name) || file.type.includes('pdf') || file.type.includes('presentation')
  if (!okType) { dialog.toast(t('slides.badType'), 'warning'); return }
  if (file.size > 25 * 1024 * 1024) { dialog.toast(t('slides.tooLarge'), 'warning'); return }
  uploading.value = true
  try {
    const fileUrl = await slideService.uploadSlideFile(file, auth.user?.id)
    const deck = await slideService.createDeck({
      classId: props.classId,
      title: file.name.replace(/\.(pdf|pptx?)$/i, ''),
      fileUrl,
      fileType: file.type || (file.name.match(/\.(\w+)$/)?.[1] || ''),
      ownerId: auth.user?.id
    })
    decks.value.unshift(deck)
    dialog.toast(t('slides.uploaded'), 'success')
  } catch (err) {
    dialog.toast(err.message || t('slides.createFailed'), 'error')
  } finally {
    uploading.value = false
  }
}

async function remove(deck) {
  const ok = await dialog.confirm({ message: t('slides.deleteDeckConfirm', { name: deck.title }), danger: true })
  if (!ok) return
  await slideService.deleteDeck(deck.id)
  decks.value = decks.value.filter((d) => d.id !== deck.id)
}
</script>

<template>
  <div>
    <div v-if="canManage" class="tab-toolbar">
      <button class="btn btn-brand btn-sm" :disabled="uploading" @click="pick">
        <span v-if="uploading" class="spinner-border spinner-border-sm"></span>
        <i v-else class="bi bi-upload"></i>{{ t('slides.upload') }}
      </button>
      <span class="slides-hint">{{ t('slides.uploadHint') }}</span>
      <input ref="fileInput" type="file" accept=".pdf,.ppt,.pptx,application/pdf" class="d-none" @change="onFile" />
    </div>

    <EmptyState v-if="!decks.length" icon="bi-easel" :title="t('slides.noDecks')" :message="t('slides.noDecksMsg')" />
    <div v-else class="slides-grid">
      <div v-for="d in decks" :key="d.id" class="slide-card">
        <button class="slide-thumb" :class="isPdf(d) ? 'is-pdf' : 'is-ppt'" @click="presenting = d">
          <i class="bi" :class="isPdf(d) ? 'bi-filetype-pdf' : 'bi-filetype-pptx'"></i>
          <span class="slide-play"><i class="bi bi-play-fill"></i></span>
        </button>
        <div class="slide-info">
          <div class="slide-title" :title="d.title">{{ d.title }}</div>
          <div class="slide-type">{{ isPdf(d) ? 'PDF' : 'PowerPoint' }}</div>
        </div>
        <button v-if="canManage" class="slide-del" :title="t('slides.deleteDeck')" @click="remove(d)"><i class="bi bi-trash"></i></button>
      </div>
    </div>

    <SlidePresenter
      v-if="presenting"
      :url="presenting.file_url"
      :file-type="presenting.file_type"
      :title="presenting.title"
      @close="presenting = null"
    />
  </div>
</template>
