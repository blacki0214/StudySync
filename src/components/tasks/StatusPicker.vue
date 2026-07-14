<script setup>
/**
 * StatusPicker — a compact dropdown that shows the current status as a coloured
 * pill and lets the user pick another, grouped by lifecycle group (Not started /
 * Active / Done / Closed) with a search box. Works off the board's live status
 * set, so it always reflects the user's custom statuses.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { STATUS_GROUPS } from '../../utils/taskStatusTemplates.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  statuses: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

const open = ref(false)
const search = ref('')
const root = ref(null)

const current = computed(() =>
  props.statuses.find((s) => s.id === props.modelValue) || props.statuses[0] || { name: '—', color: '#8b95a5' }
)
const groups = computed(() =>
  STATUS_GROUPS
    .map((g) => ({
      ...g,
      items: props.statuses.filter(
        (s) => s.group === g.key && (!search.value || s.name.toLowerCase().includes(search.value.toLowerCase()))
      )
    }))
    .filter((g) => g.items.length)
)

function toggle() { open.value = !open.value; search.value = '' }
function choose(s) { emit('update:modelValue', s.id); open.value = false; search.value = '' }
function onDoc(e) { if (root.value && !root.value.contains(e.target)) open.value = false }
onMounted(() => document.addEventListener('click', onDoc))
onUnmounted(() => document.removeEventListener('click', onDoc))
</script>

<template>
  <div ref="root" class="status-picker" :class="{ open }">
    <button type="button" class="status-pill" :class="{ compact }" @click.stop="toggle">
      <span class="status-dot" :style="{ background: current.color }"></span>
      <span class="status-name">{{ current.name }}</span>
      <i class="bi bi-chevron-down status-caret"></i>
    </button>

    <div v-if="open" class="status-menu" @click.stop>
      <input v-model="search" class="status-search" :placeholder="t('tasks.searchStatus')" />
      <div v-for="g in groups" :key="g.key" class="status-group">
        <div class="status-group-label">{{ t(g.i18n) }}</div>
        <button
          v-for="s in g.items"
          :key="s.id"
          type="button"
          class="status-option"
          :class="{ active: s.id === modelValue }"
          @click="choose(s)"
        >
          <span class="status-dot" :style="{ background: s.color }"></span>
          <span class="status-name">{{ s.name }}</span>
          <i v-if="s.id === modelValue" class="bi bi-check2 status-check"></i>
        </button>
      </div>
    </div>
  </div>
</template>
