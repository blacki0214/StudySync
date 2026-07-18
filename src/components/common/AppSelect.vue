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
const triggerRef = ref(null)
const menuRef = ref(null)
// The menu is teleported to <body> so it can never be clipped by an ancestor's
// overflow (e.g. the horizontally-scrolling mobile editor toolbar); its position
// is computed from the trigger's rect each time it opens / the page scrolls.
const menuStyle = ref({})

const selected = computed(() => props.options.find((o) => o.value === props.modelValue) || null)
const label = computed(() => (selected.value ? selected.value.label : props.placeholder))

function positionMenu() {
  const el = triggerRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const minW = Math.max(r.width, 150)
  let left = r.left
  if (left + minW > vw - 8) left = Math.max(8, vw - 8 - minW) // keep on-screen
  const menuH = menuRef.value?.offsetHeight || 0
  let top = r.bottom + 6
  // Flip above the trigger if it would overflow the bottom of the viewport.
  if (menuH && top + menuH > vh - 8) top = Math.max(8, r.top - 6 - menuH)
  menuStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    right: 'auto',
    minWidth: `${minW}px`,
    zIndex: 3000
  }
}

function openMenu() {
  open.value = true
  // Highlight the current selection (or the first item) when opening.
  activeIndex.value = Math.max(props.options.findIndex((o) => o.value === props.modelValue), 0)
  nextTick(positionMenu)
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
  const inRoot = root.value && root.value.contains(e.target)
  const inMenu = menuRef.value && menuRef.value.contains(e.target)
  if (!inRoot && !inMenu) close()
}
// While open, keep the teleported menu glued to the trigger as the page or any
// scroll container (the toolbar) moves; reposition on scroll (capture=true
// catches ancestor scrolls) and on resize.
watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('scroll', positionMenu, true)
    window.addEventListener('resize', positionMenu)
  } else {
    window.removeEventListener('scroll', positionMenu, true)
    window.removeEventListener('resize', positionMenu)
  }
})
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('scroll', positionMenu, true)
  window.removeEventListener('resize', positionMenu)
})
</script>

<template>
  <div ref="root" class="app-select" :class="{ open }">
    <button
      ref="triggerRef"
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

    <Teleport to="body">
      <ul v-if="open" ref="menuRef" class="app-select-menu app-select-menu-float" :style="menuStyle" role="listbox">
        <template v-for="(o, i) in options" :key="String(i)">
          <!-- Group header, shown once when the group changes (optional). -->
          <li v-if="o.group && (i === 0 || options[i - 1].group !== o.group)" class="app-select-group" role="presentation">{{ o.group }}</li>
          <li>
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
        </template>
      </ul>
    </Teleport>
  </div>
</template>
