<script setup>
/**
 * SlidePresenter — a fullscreen presenter for an uploaded slide deck. PDFs are
 * rendered page-by-page with pdf.js (click / arrow keys / space to advance);
 * PowerPoint files can't be rendered in-browser, so they offer a download.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const props = defineProps({
  url: { type: String, required: true },
  fileType: { type: String, default: '' },
  title: { type: String, default: '' }
})
const emit = defineEmits(['close'])
const { t } = useI18n()

const isPdf = computed(() =>
  (props.fileType || '').toLowerCase().includes('pdf') || (props.url || '').toLowerCase().includes('.pdf')
)

const canvasEl = ref(null)
const page = ref(1)
const pageCount = ref(0)
const loading = ref(true)
const error = ref(false)
let pdf = null

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', render)
  if (!isPdf.value) { loading.value = false; return }
  try {
    pdf = await pdfjsLib.getDocument(props.url).promise
    pageCount.value = pdf.numPages
    await render()
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', render)
})

async function render() {
  if (!pdf || !canvasEl.value) return
  const pg = await pdf.getPage(page.value)
  const base = pg.getViewport({ scale: 1 })
  const scale = Math.min((window.innerWidth * 0.94) / base.width, (window.innerHeight * 0.82) / base.height)
  const viewport = pg.getViewport({ scale })
  const canvas = canvasEl.value
  canvas.width = viewport.width
  canvas.height = viewport.height
  await pg.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
}
function step(d) {
  if (!pageCount.value) return
  page.value = Math.min(pageCount.value, Math.max(1, page.value + d))
  render()
}
function onKey(e) {
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); step(1) }
  else if (e.key === 'ArrowLeft') step(-1)
  else if (e.key === 'Escape') emit('close')
}
</script>

<template>
  <div class="sp-overlay">
    <div class="sp-stage">
      <canvas v-if="isPdf" ref="canvasEl" class="sp-canvas" @click="step(1)"></canvas>

      <div v-if="loading" class="sp-msg"><div class="spinner-border"></div></div>
      <div v-else-if="error || !isPdf" class="sp-msg sp-fallback">
        <i class="bi bi-filetype-pptx"></i>
        <p>{{ error ? t('slides.presentError') : t('slides.pptxNote') }}</p>
        <a :href="url" :download="title" class="btn btn-brand"><i class="bi bi-download"></i>{{ t('slides.download') }}</a>
      </div>
    </div>

    <div class="sp-bar">
      <template v-if="isPdf && !error">
        <button :aria-label="t('slides.prev')" @click="step(-1)"><i class="bi bi-chevron-left"></i></button>
        <span class="sp-count">{{ page }} / {{ pageCount || '…' }}</span>
        <button :aria-label="t('slides.next')" @click="step(1)"><i class="bi bi-chevron-right"></i></button>
      </template>
      <a :href="url" :download="title" class="sp-dl" :title="t('slides.download')"><i class="bi bi-download"></i></a>
      <button class="sp-exit" @click="emit('close')"><i class="bi bi-x-lg"></i>{{ t('slides.exit') }}</button>
    </div>
  </div>
</template>
