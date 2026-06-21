<script setup>
/**
 * AppSelect — a small, fully theme-able replacement for the native <select>.
 *
 * Native selects render their option list with the OS, which looks "default" and
 * is hard to style consistently in dark mode. This component renders a branded
 * trigger + popup that uses the same design tokens as the rest of the app, with
 * keyboard support (↑/↓ to move, Enter to choose, Esc to close) and
 * click-outside to dismiss.
 *
 * Options are `{ value, label }`. `value` may be a string, number or object
 * (matched by identity), so it can stand in for any existing v-model.
 */
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number, Object, null], default: '' },
  options: { type: Array, default: () => [] }, // [{ value, label }]
  placeholder: { type: String, default: 'Select…' },
  ariaLabel: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const activeIndex = ref(-1)
const root = ref(null)

const selected = computed(() => props.options.find((o) => o.value === props.modelValue) || null)
const label = computed(() => (selected.value ? selected.value.label : props.placeholder))

function openMenu() {
  open.value = true
  // Highlight the current selection (or the first item) when opening.
  activeIndex.value = Math.max(props.options.findIndex((o) => o.value === props.modelValue), 0)
}
function close() {
  open.value = false
  activeIndex.value = -1
}
function toggle() {
  open.value ? close() : openMenu()
}
function choose(o) {
  emit('update:modelValue', o.value)
  close()
}
function move(delta) {
  if (!open.value) return openMenu()
  const n = props.options.length
  if (!n) return
  activeIndex.value = (activeIndex.value + delta + n) % n
}
function chooseActive() {
  if (open.value && props.options[activeIndex.value]) choose(props.options[activeIndex.value])
  else openMenu()
}

function onDocClick(e) {
  if (root.value && !root.value.contains(e.target)) close()
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="root" class="app-select" :class="{ open }">
    <button
      type="button"
      class="app-select-trigger"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click.stop="toggle"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="chooseActive"
      @keydown.esc="close"
    >
      <span class="app-select-value" :class="{ placeholder: !selected }">{{ label }}</span>
      <i class="bi bi-chevron-down app-select-caret"></i>
    </button>

    <ul v-if="open" class="app-select-menu" role="listbox">
      <li v-for="(o, i) in options" :key="String(i)">
        <button
          type="button"
          class="app-select-option"
          :class="{ active: o.value === modelValue, highlight: i === activeIndex }"
          role="option"
          :aria-selected="o.value === modelValue"
          @click="choose(o)"
          @mouseenter="activeIndex = i"
        >
          <span class="app-select-option-label">{{ o.label }}</span>
          <i v-if="o.value === modelValue" class="bi bi-check2 app-select-check"></i>
        </button>
      </li>
    </ul>
  </div>
</template>
