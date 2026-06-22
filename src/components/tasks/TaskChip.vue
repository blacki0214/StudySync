<script setup>
/**
 * TaskChip — a small coloured pill for a task's status, priority or type.
 * Colours come from styles/tasks.css; the label is translated from taskMeta.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { statusMeta, priorityMeta, typeMeta } from '../../utils/taskMeta.js'

const props = defineProps({
  kind: { type: String, required: true }, // 'status' | 'priority' | 'type'
  value: { type: String, required: true }
})
const { t } = useI18n()
const meta = computed(() =>
  props.kind === 'status' ? statusMeta(props.value)
  : props.kind === 'priority' ? priorityMeta(props.value)
  : typeMeta(props.value)
)
</script>

<template>
  <span class="task-chip" :class="meta.cls">
    <span v-if="kind === 'status'" class="task-chip-dot"></span>{{ t(meta.i18n) }}
  </span>
</template>
