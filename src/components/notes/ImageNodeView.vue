<script setup>
/**
 * ImageNodeView — the in-document editor UI for a ResizableImage. Shows a
 * floating toolbar (rotate, align, reset, delete) when the image is selected,
 * and a corner handle to drag-resize. All changes go through updateAttributes
 * so they sync via Yjs and persist in the saved HTML.
 */
import { computed, ref } from 'vue'
import { NodeViewWrapper } from '@tiptap/vue-3'

const props = defineProps({
  node: { type: Object, required: true },
  updateAttributes: { type: Function, required: true },
  deleteNode: { type: Function, required: true },
  editor: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})

const root = ref(null)
const imgEl = ref(null)

const align = computed(() => props.node.attrs.align || 'left')
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
function resetSize() { props.updateAttributes({ width: null }) }
function remove() { props.deleteNode() }

function startResize(e) {
  const startX = e.clientX
  const startW = imgEl.value?.clientWidth || props.node.attrs.width || 320
  const max = root.value?.closest('.ProseMirror')?.clientWidth || 900
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
  <node-view-wrapper ref="root" class="img-nv" :class="['align-' + align, { selected }]">
    <div class="img-nv-frame">
      <img ref="imgEl" :src="node.attrs.src" :alt="node.attrs.alt || ''" :style="imgStyle" draggable="false" />

      <div v-if="editable && selected" class="img-nv-toolbar" contenteditable="false">
        <button type="button" title="Rotate left" @click="rotate(-90)"><i class="bi bi-arrow-counterclockwise"></i></button>
        <button type="button" title="Rotate right" @click="rotate(90)"><i class="bi bi-arrow-clockwise"></i></button>
        <span class="img-nv-sep"></span>
        <button type="button" title="Align left" :class="{ on: align === 'left' }" @click="setAlign('left')"><i class="bi bi-text-left"></i></button>
        <button type="button" title="Align center" :class="{ on: align === 'center' }" @click="setAlign('center')"><i class="bi bi-text-center"></i></button>
        <button type="button" title="Align right" :class="{ on: align === 'right' }" @click="setAlign('right')"><i class="bi bi-text-right"></i></button>
        <span class="img-nv-sep"></span>
        <button type="button" title="Reset size" @click="resetSize"><i class="bi bi-aspect-ratio"></i></button>
        <button type="button" title="Delete" class="danger" @click="remove"><i class="bi bi-trash"></i></button>
      </div>

      <span v-if="editable && selected" class="img-nv-handle" contenteditable="false" @pointerdown.prevent="startResize"></span>
    </div>
  </node-view-wrapper>
</template>
