<script setup>
/**
 * SlideEditorView — the native slide editor (Phase 3). A deck is an ordered list
 * of slides; each slide holds positioned blocks (text / image / shape). Blocks
 * are dragged by their handle and text is edited inline. Percent-based geometry
 * keeps the canvas responsive. Autosaves (debounced) via slideService, and has a
 * fullscreen presenter mode.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { slideService, blankSlide } from '../services/slideService.js'
import { useDialogStore } from '../stores/dialogStore.js'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const dialog = useDialogStore()

const deck = ref(null)
const ready = ref(false)
const current = ref(0)
const selectedId = ref(null)
const presenting = ref(false)
const canvasEl = ref(null)
let saveTimer = null
let uid = Date.now()
const newId = (p) => `${p}-${++uid}`

const slides = computed(() => deck.value?.slides || [])
const slide = computed(() => slides.value[current.value] || null)

onMounted(async () => {
  deck.value = await slideService.getDeck(route.params.deckId)
  if (!deck.value) { router.replace('/'); return }
  if (!deck.value.slides?.length) deck.value.slides = [blankSlide()]
  ready.value = true
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  window.removeEventListener('keydown', onKey)
})

// Debounced autosave whenever the deck changes.
watch(deck, () => {
  if (!ready.value) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    slideService.saveDeck(deck.value.id, { title: deck.value.title, slides: deck.value.slides })
  }, 700)
}, { deep: true })

// --- Slides ---------------------------------------------------------------
function selectSlide(i) { current.value = i; selectedId.value = null }
function addSlide() {
  deck.value.slides.splice(current.value + 1, 0, blankSlide())
  current.value += 1
  selectedId.value = null
}
function removeSlide(i) {
  if (deck.value.slides.length <= 1) return
  deck.value.slides.splice(i, 1)
  current.value = Math.max(0, Math.min(current.value, deck.value.slides.length - 1))
}

// --- Blocks ---------------------------------------------------------------
function addBlock(type) {
  if (!slide.value) return
  const base = { id: newId('b'), type, x: 30, y: 35, w: 40, h: 18 }
  if (type === 'text') Object.assign(base, { text: t('slides.textPlaceholder'), size: 28, color: 'var(--slide-ink)' })
  if (type === 'shape') Object.assign(base, { h: 22, color: '#6366f1' })
  slide.value.blocks.push(base)
  selectedId.value = base.id
}
function removeBlock(id) {
  slide.value.blocks = slide.value.blocks.filter((b) => b.id !== id)
  if (selectedId.value === id) selectedId.value = null
}
function onText(block, e) { block.text = e.target.innerText }

const imageInput = ref(null)
function pickImage() { imageInput.value?.click() }
function onImage(e) {
  const file = e.target.files?.[0]; e.target.value = ''
  if (!file || !file.type.startsWith('image/')) return
  const reader = new FileReader()
  reader.onload = () => {
    const b = { id: newId('b'), type: 'image', x: 25, y: 20, w: 50, h: 45, src: reader.result }
    slide.value.blocks.push(b); selectedId.value = b.id
  }
  reader.readAsDataURL(file)
}

// --- Drag (percent of canvas) --------------------------------------------
let drag = null
function startDrag(block, e) {
  e.preventDefault()
  selectedId.value = block.id
  const rect = canvasEl.value.getBoundingClientRect()
  drag = { block, rect, offX: e.clientX / rect.width * 100 - block.x, offY: e.clientY / rect.height * 100 - block.y }
  window.addEventListener('pointermove', onDrag)
  window.addEventListener('pointerup', endDrag)
}
function onDrag(e) {
  if (!drag) return
  const { block, rect, offX, offY } = drag
  block.x = Math.max(0, Math.min(96, e.clientX / rect.width * 100 - offX))
  block.y = Math.max(0, Math.min(96, e.clientY / rect.height * 100 - offY))
}
function endDrag() {
  drag = null
  window.removeEventListener('pointermove', onDrag)
  window.removeEventListener('pointerup', endDrag)
}

// --- Present --------------------------------------------------------------
function present() { presenting.value = true; selectedId.value = null }
function exitPresent() { presenting.value = false }
function step(d) {
  const n = slides.value.length
  current.value = (current.value + d + n) % n
}
function onKey(e) {
  if (presenting.value) {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); step(1) }
    else if (e.key === 'ArrowLeft') step(-1)
    else if (e.key === 'Escape') exitPresent()
  }
}
</script>

<template>
  <LoadingSpinner v-if="!ready" :label="t('slides.loading')" />

  <div v-else class="slide-editor">
    <!-- Top bar -->
    <div class="se-topbar">
      <button class="se-back" :aria-label="t('mobile.back')" @click="router.back()"><i class="bi bi-chevron-left"></i></button>
      <input v-model="deck.title" class="se-title" :placeholder="t('slides.deckTitle')" />
      <div class="se-actions">
        <span class="se-saved"><i class="bi bi-cloud-check"></i>{{ t('slides.saved') }}</span>
        <button class="btn btn-brand btn-sm" @click="present"><i class="bi bi-play-fill"></i>{{ t('slides.present') }}</button>
      </div>
    </div>

    <div class="se-body">
      <!-- Filmstrip -->
      <div class="se-filmstrip">
        <button
          v-for="(s, i) in slides"
          :key="s.id"
          class="se-thumb"
          :class="{ active: i === current }"
          @click="selectSlide(i)"
        >
          <span class="se-thumb-num">{{ i + 1 }}</span>
          <span class="se-thumb-canvas">
            <span v-for="b in s.blocks" :key="b.id" class="se-thumb-block" :class="b.type"
              :style="{ left: b.x+'%', top: b.y+'%', width: b.w+'%', height: b.h+'%', background: b.type==='shape' ? b.color : null }">
              <template v-if="b.type==='text'">{{ b.text }}</template>
              <img v-else-if="b.type==='image'" :src="b.src" alt="" />
            </span>
          </span>
          <span v-if="slides.length > 1" class="se-thumb-del" :title="t('slides.deleteSlide')" @click.stop="removeSlide(i)"><i class="bi bi-x"></i></span>
        </button>
        <button class="se-add-slide" @click="addSlide"><i class="bi bi-plus-lg"></i>{{ t('slides.addSlide') }}</button>
      </div>

      <!-- Stage -->
      <div class="se-stage">
        <div class="se-toolbar">
          <button class="se-tool" @click="addBlock('text')"><i class="bi bi-fonts"></i>{{ t('slides.text') }}</button>
          <button class="se-tool" @click="pickImage"><i class="bi bi-image"></i>{{ t('slides.image') }}</button>
          <button class="se-tool" @click="addBlock('shape')"><i class="bi bi-square-fill"></i>{{ t('slides.shape') }}</button>
          <input ref="imageInput" type="file" accept="image/*" class="d-none" @change="onImage" />
        </div>

        <div class="se-canvas-wrap">
          <div ref="canvasEl" class="se-canvas" @pointerdown.self="selectedId = null">
            <div
              v-for="b in (slide ? slide.blocks : [])"
              :key="b.id"
              class="se-block"
              :class="[b.type, { selected: selectedId === b.id }]"
              :style="{ left: b.x+'%', top: b.y+'%', width: b.w+'%', height: b.h+'%' }"
              @pointerdown="selectedId = b.id"
            >
              <!-- move handle -->
              <span class="se-handle" @pointerdown.stop="startDrag(b, $event)"><i class="bi bi-arrows-move"></i></span>
              <button v-if="selectedId === b.id" class="se-block-del" @pointerdown.stop @click="removeBlock(b.id)"><i class="bi bi-trash"></i></button>

              <div
                v-if="b.type === 'text'"
                class="se-text"
                :style="{ fontSize: b.size + 'px' }"
                contenteditable="true"
                @input="onText(b, $event)"
                @pointerdown.stop
                v-text="b.text"
              ></div>
              <img v-else-if="b.type === 'image'" :src="b.src" class="se-img" alt="" />
              <div v-else class="se-shape" :style="{ background: b.color }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Presenter -->
    <div v-if="presenting" class="se-present" @click="step(1)">
      <div class="se-present-canvas">
        <div v-for="b in (slide ? slide.blocks : [])" :key="b.id" class="se-block present" :class="b.type"
          :style="{ left: b.x+'%', top: b.y+'%', width: b.w+'%', height: b.h+'%' }">
          <div v-if="b.type==='text'" class="se-text" :style="{ fontSize: b.size + 'px' }">{{ b.text }}</div>
          <img v-else-if="b.type==='image'" :src="b.src" class="se-img" alt="" />
          <div v-else class="se-shape" :style="{ background: b.color }"></div>
        </div>
      </div>
      <div class="se-present-bar" @click.stop>
        <button @click="step(-1)"><i class="bi bi-chevron-left"></i></button>
        <span>{{ current + 1 }} / {{ slides.length }}</span>
        <button @click="step(1)"><i class="bi bi-chevron-right"></i></button>
        <button class="se-present-exit" @click="exitPresent"><i class="bi bi-x-lg"></i>{{ t('slides.exit') }}</button>
      </div>
    </div>
  </div>
</template>
