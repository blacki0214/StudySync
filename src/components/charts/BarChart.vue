<script setup>
/**
 * BarChart — minimal dependency-free SVG bar chart (the "Cards reviewed" widget).
 * Rounded purple bars with x labels. Pure rule-based geometry, no library.
 */
import { computed } from 'vue'

const props = defineProps({
  labels: { type: Array, required: true },
  values: { type: Array, required: true },
  height: { type: Number, default: 180 }
})

const W = 360
const padT = 10
const padB = 26
const ceiling = computed(() => Math.max(...props.values, 1))

const bars = computed(() => {
  const n = props.values.length
  const gap = 10
  const barW = (W - gap * (n - 1)) / n
  const plotH = props.height - padT - padB
  return props.values.map((v, i) => {
    const h = (v / ceiling.value) * plotH
    return {
      x: i * (barW + gap),
      y: padT + (plotH - h),
      w: barW,
      h,
      label: props.labels[i]
    }
  })
})
</script>

<template>
  <svg class="bar-svg" :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="none" role="img">
    <defs>
      <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#8b5cf6" />
        <stop offset="100%" stop-color="#a78bfa" />
      </linearGradient>
    </defs>
    <g v-for="(b, i) in bars" :key="i">
      <rect :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="5" fill="url(#bar-grad)" />
      <text :x="b.x + b.w / 2" :y="height - 8" class="bar-axis" text-anchor="middle">{{ b.label }}</text>
    </g>
  </svg>
</template>

<style scoped>
.bar-svg {
  width: 100%;
  height: v-bind('height + "px"');
  display: block;
}
.bar-axis {
  fill: var(--c-text-faint);
  font-size: 11px;
  font-family: var(--font-sans);
}
</style>
