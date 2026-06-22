<script setup>
/**
 * CodeBlockView — node view for the highlighted code block. Adds a draggable
 * window title bar (with the traffic-light dots) so the whole block can be
 * moved/reordered by grabbing the bar instead of selecting the code. The editable
 * code lives in <node-view-content> so lowlight highlighting keeps working.
 */
import { NodeViewWrapper, NodeViewContent } from '@tiptap/vue-3'

defineProps({
  node: { type: Object, required: true },
  editor: { type: Object, required: true }
})
</script>

<template>
  <node-view-wrapper class="code-nv">
    <!-- Drag handle: grab this bar to move the whole code block. -->
    <div class="code-nv-bar" contenteditable="false" data-drag-handle draggable="true"></div>
    <pre><node-view-content as="code" /></pre>
  </node-view-wrapper>
</template>
