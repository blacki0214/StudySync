<script setup>
/**
 * Pagination — a reusable, accessible page control for any list.
 *
 * Owns no data: it is given the total number of items and the page size, and
 * reports the page the user picked through v-model. The parent stays the single
 * source of truth for what is actually on screen, which is what lets the same
 * component sit under the notes grid and the community feed without either one
 * knowing about the other.
 *
 *   <Pagination v-model="page" :total="filtered.length" :per-page="9" />
 *
 * Accessibility: the whole control is a labelled <nav>, the current page is
 * marked with aria-current="page" (so a screen reader announces *which* page is
 * active rather than just reading eight numbers), the gap items are inert
 * <span aria-hidden> rather than disabled buttons, and a polite live region
 * announces the range whenever the page changes.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  /** Current page, 1-based. */
  modelValue: { type: Number, required: true },
  /** Total number of items across all pages. */
  total: { type: Number, required: true },
  /** Items per page. */
  perPage: { type: Number, default: 10 },
  /** How many numbered buttons to show around the current page. */
  window: { type: Number, default: 1 }
})
const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.perPage)))

/** 1-based index of the first and last item currently shown. */
const rangeStart = computed(() => (props.total === 0 ? 0 : (props.modelValue - 1) * props.perPage + 1))
const rangeEnd = computed(() => Math.min(props.modelValue * props.perPage, props.total))

/**
 * The button row: always the first and last page, plus a window around the
 * current one, with '…' standing in for whatever was skipped. Building it as a
 * computed keeps the template free of index arithmetic.
 */
const pages = computed(() => {
  const last = totalPages.value
  const cur = props.modelValue
  const w = props.window

  if (last <= 5 + w * 2) return Array.from({ length: last }, (_, i) => i + 1)

  const out = [1]
  const from = Math.max(2, cur - w)
  const to = Math.min(last - 1, cur + w)

  if (from > 2) out.push('gap-start')
  for (let p = from; p <= to; p++) out.push(p)
  if (to < last - 1) out.push('gap-end')

  out.push(last)
  return out
})

function goTo(page) {
  const clamped = Math.min(Math.max(1, page), totalPages.value)
  if (clamped !== props.modelValue) emit('update:modelValue', clamped)
}
</script>

<template>
  <nav v-if="totalPages > 1" class="pager" :aria-label="t('pager.label')">
    <!-- Screen readers get the range spoken on every change; sighted users read
         the same information from the summary line below. -->
    <p class="pager-status" role="status" aria-live="polite">
      {{ t('pager.showing', { from: rangeStart, to: rangeEnd, total }) }}
    </p>

    <ul class="pager-list">
      <li>
        <button
          type="button"
          class="pager-btn pager-arrow"
          :disabled="modelValue === 1"
          :aria-label="t('pager.previous')"
          @click="goTo(modelValue - 1)"
        ><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
      </li>

      <li v-for="(p, i) in pages" :key="typeof p === 'number' ? `p${p}` : `${p}${i}`">
        <span v-if="typeof p === 'string'" class="pager-gap" aria-hidden="true">…</span>
        <button
          v-else
          type="button"
          class="pager-btn"
          :class="{ active: p === modelValue }"
          :aria-label="t('pager.page', { n: p })"
          :aria-current="p === modelValue ? 'page' : undefined"
          @click="goTo(p)"
        >{{ p }}</button>
      </li>

      <li>
        <button
          type="button"
          class="pager-btn pager-arrow"
          :disabled="modelValue === totalPages"
          :aria-label="t('pager.next')"
          @click="goTo(modelValue + 1)"
        ><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
      </li>
    </ul>
  </nav>
</template>
