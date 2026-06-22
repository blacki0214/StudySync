<script setup>
/**
 * ImageNodeView — the in-document editor UI for a ResizableImage. When the image
 * is selected it shows a Google-Docs-style toolbar: align, size presets, rotate,
 * and a "more" menu (replace, alt text, download, reset, delete). A corner handle
 * drag-resizes. Everything goes through updateAttributes so it syncs via Yjs and
 * persists in the saved HTML.
 */
import { computed, ref, onBeforeUnmount } from 'vue'
import { NodeViewWrapper } from '@tiptap/vue-3'

const props = defineProps({
  node: { type: Object, required: true },
  updateAttributes: { type: Function, required: true },
  deleteNode: { type: Function, required: true },
  editor: { type: Object, required: true },
  getPos: { type: Function, default: null },
  selected: { type: Boolean, default: false }
})

const root = ref(null)
const imgEl = ref(null)
const fileInput = ref(null)
const menuOpen = ref(false)

const align = computed(() => props.node.attrs.align || 'left')
const wrap = computed(() => props.node.attrs.wrap || 'none')
const editable = computed(() => props.editor.isEditable)
const imgStyle = computed(() => ({
  width: props.node.attrs.width ? props.node.attrs.width + 'px' : undefined,
  transform: props.node.attrs.rotate ? `rotate(${props.node.attrs.rotate}deg)` : undefined
}))

function rotate(delta) {
  const r = (((props.node.attrs.rotate || 0) + delta) % 360 + 360) % 360
  props.updateAttributes({ rotate: r })
}
function setAlign(a) { props.updateAttributes({ align: a }) }
function setWrap(w) {
  props.updateAttributes({ wrap: w })
  // When wrapping, make sure there's a paragraph beside the image to type into,
  // and drop the cursor there so the user can immediately write next to it.
  if (w !== 'none') ensureTextBeside()
}
function ensureTextBeside() {
  const editor = props.editor
  const pos = props.getPos?.()
  if (typeof pos !== 'number') return
  const after = pos + props.node.nodeSize
  const next = editor.state.doc.nodeAt(after)
  if (next && next.type.name === 'paragraph') {
    editor.chain().focus().setTextSelection(after + 1).run()
  } else {
    editor.chain().focus().insertContentAt(after, { type: 'paragraph' }).setTextSelection(after + 1).run()
  }
}
function setSize(px) { props.updateAttributes({ width: px }) }
function resetSize() { props.updateAttributes({ width: null }); menuOpen.value = false }
function remove() { props.deleteNode() }

function editAlt() {
  const alt = window.prompt('Alt text (description):', props.node.attrs.alt || '')
  if (alt !== null) props.updateAttributes({ alt })
  menuOpen.value = false
}
function download() {
  const a = document.createElement('a')
  a.href = props.node.attrs.src
  a.download = (props.node.attrs.alt || 'image').replace(/[^\w.-]/g, '_')
  document.body.appendChild(a); a.click(); a.remove()
  menuOpen.value = false
}
function pickReplace() { fileInput.value?.click() }
function onReplace(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  menuOpen.value = false
  if (!file || !file.type.startsWith('image/')) return
  const reader = new FileReader()
  reader.onload = () => props.updateAttributes({ src: reader.result })
  reader.readAsDataURL(file)
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
  if (menuOpen.value) window.addEventListener('click', closeMenuOnOutside, true)
}
function closeMenuOnOutside(e) {
  if (root.value?.$el && !root.value.$el.contains(e.target)) closeMenu()
}
function closeMenu() {
  menuOpen.value = false
  window.removeEventListener('click', closeMenuOnOutside, true)
}
onBeforeUnmount(() => window.removeEventListener('click', closeMenuOnOutside, true))

function startResize(e) {
  const startX = e.clientX
  const startW = imgEl.value?.clientWidth || props.node.attrs.width || 320
  const max = imgEl.value?.closest('.ProseMirror')?.clientWidth || 900
  const onMove = (ev) => {
    const w = Math.max(80, Math.min(max, Math.round(startW + (ev.clientX - startX))))
    props.updateAttributes({ width: w })
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}
</script>

<template>
  <node-view-wrapper ref="root" class="img-nv" :class="['align-' + align, 'wrap-' + wrap, { selected }]">
    <div class="img-nv-frame">
      <img ref="imgEl" :src="node.attrs.src" :alt="node.attrs.alt || ''" :style="imgStyle" draggable="false" />

      <div v-if="editable && selected" class="img-nv-toolbar" contenteditable="false">
        <button type="button" title="Align left" :class="{ on: align === 'left' }" @click="setAlign('left')"><i class="bi bi-text-left"></i></button>
        <button type="button" title="Align center" :class="{ on: align === 'center' }" @click="setAlign('center')"><i class="bi bi-text-center"></i></button>
        <button type="button" title="Align right" :class="{ on: align === 'right' }" @click="setAlign('right')"><i class="bi bi-text-right"></i></button>
        <span class="img-nv-sep"></span>
        <button type="button" title="No wrap (own line)" :class="{ on: wrap === 'none' }" @click="setWrap('none')"><i class="bi bi-distribute-vertical"></i></button>
        <button type="button" title="Wrap text — image left" :class="{ on: wrap === 'left' }" @click="setWrap('left')"><i class="bi bi-layout-sidebar-inset"></i></button>
        <button type="button" title="Wrap text — image right" :class="{ on: wrap === 'right' }" @click="setWrap('right')"><i class="bi bi-layout-sidebar-inset-reverse"></i></button>
        <span class="img-nv-sep"></span>
        <button type="button" class="img-nv-size" title="Small" @click="setSize(200)">S</button>
        <button type="button" class="img-nv-size" title="Medium" @click="setSize(380)">M</button>
        <button type="button" class="img-nv-size" title="Large" @click="setSize(560)">L</button>
        <button type="button" class="img-nv-size" title="Full width" @click="setSize(null)">Full</button>
        <span class="img-nv-sep"></span>
        <button type="button" title="Rotate left" @click="rotate(-90)"><i class="bi bi-arrow-counterclockwise"></i></button>
        <button type="button" title="Rotate right" @click="rotate(90)"><i class="bi bi-arrow-clockwise"></i></button>
        <span class="img-nv-sep"></span>
        <button type="button" title="More" :class="{ on: menuOpen }" @click.stop="toggleMenu"><i class="bi bi-three-dots-vertical"></i></button>

        <div v-if="menuOpen" class="img-nv-menu">
          <button type="button" @click="pickReplace"><i class="bi bi-arrow-repeat"></i> Replace image</button>
          <button type="button" @click="editAlt"><i class="bi bi-card-text"></i> Alt text</button>
          <button type="button" @click="download"><i class="bi bi-download"></i> Download</button>
          <button type="button" @click="resetSize"><i class="bi bi-aspect-ratio"></i> Reset size</button>
          <hr />
          <button type="button" class="danger" @click="remove"><i class="bi bi-trash"></i> Delete</button>
        </div>
      </div>

      <span
        v-if="editable && selected"
        class="img-nv-handle"
        contenteditable="false"
        draggable="false"
        @pointerdown.prevent.stop="startResize"
        @mousedown.prevent.stop
        @dragstart.prevent.stop
      ></span>
    </div>

    <input ref="fileInput" type="file" accept="image/*" class="d-none" @change="onReplace" />
  </node-view-wrapper>
</template>
