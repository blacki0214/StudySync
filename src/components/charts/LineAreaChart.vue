<script setup>
/**
 * LineAreaChart — a lightweight, dependency-free SVG line/area chart.
 *
 * It draws a smooth curve through the data points using a Catmull-Rom spline
 * converted to cubic Bézier segments (so we get the soft curves in the Figma
 * without any chart library). Set `area` to fill under the line with a gradient.
 *
 * Props:
 *   labels  string[]  x-axis labels
 *   values  number[]  y values (same length as labels)
 *   max     number    y-axis ceiling (defaults to max value)
 *   ticks   number    how many y gridlines/labels (default 4)
 *   area    boolean   fill under the curve
 */
import { computed } from 'vue'

const props = defineProps({
  labels: { type: Array, required: true },
  values: { type: Array, required: true },
  max: { type: Number, default: 0 },
  ticks: { type: Number, default: 4 },
  area: { type: Boolean, default: true },
  height: { type: Number, default: 220 }
})

// Internal SVG coordinate space (viewBox); CSS scales it responsively.
const W = 640
const H = computed(() => props.height)
const padL = 34
const padR = 12
const padT = 14
const padB = 28

const ceiling = computed(() => props.max || Math.max(...props.values, 1))

// Map a data index/value to an SVG x/y coordinate.
const plotW = computed(() => W - padL - padR)
const plotH = computed(() => H.value - padT - padB)
const xAt = (i) => padL + (props.values.length === 1 ? plotW.value / 2 : (i / (props.values.length - 1)) * plotW.value)
// Plotted against the rounded-up ceiling so points line up with the gridlines.
const yAt = (v) => padT + plotH.value - (v / niceCeiling.value) * plotH.value

const points = computed(() => props.values.map((v, i) => [xAt(i), yAt(v)]))

/**
 * Build a smooth path using Catmull-Rom → cubic Bézier. Each segment's control
 * points are derived from neighbouring points, giving a natural curve.
 */
const linePath = computed(() => {
  const p = points.value
  if (p.length < 2) return ''
  let d = `M ${p[0][0]},${p[0][1]}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i]
    const p1 = p[i]
    const p2 = p[i + 1]
    const p3 = p[i + 2] || p2
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`
  }
  return d
})

// Close the line path down to the baseline to make a filled area.
const areaPath = computed(() => {
  if (!linePath.value) return ''
  const p = points.value
  const baseline = padT + plotH.value
  return `${linePath.value} L ${p[p.length - 1][0]},${baseline} L ${p[0][0]},${baseline} Z`
})

/**
 * Y-axis gridline values (0 … ceiling).
 * The ceiling is rounded UP to a "nice" step first, so the labels are always
 * distinct whole numbers. Rounding each raw tick instead produced duplicates
 * on small ranges (ceiling 1 over 4 ticks → 0, 0, 1, 1, 1).
 */
/** Snap a raw step up to a readable 1 / 2 / 2.5 / 3 / 5 / 10 × 10ⁿ value. */
function niceStep(raw) {
  if (!(raw > 0)) return 1
  const base = Math.pow(10, Math.floor(Math.log10(raw)))
  const m = raw / base
  const mult = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 3 ? 3 : m <= 5 ? 5 : 10
  return mult * base
}
const step = computed(() => niceStep(ceiling.value / props.ticks))
const niceCeiling = computed(() => step.value * props.ticks)
const yTicks = computed(() =>
  Array.from({ length: props.ticks + 1 }, (_, i) => {
    const value = step.value * i
    // Round to 2dp then strip trailing zeros: keeps small steps distinct
    // (0.05 → "0.05") without printing "3.00" for whole ones.
    const label = String(parseFloat(value.toFixed(2)))
    return { value, label, y: yAt(value) }
  })
)

// Unique gradient id so multiple charts on one page don't collide.
const gid = computed(() => 'area-' + props.labels.join('').replace(/\W/g, '').slice(0, 8))
</script>

<template>
  <svg class="chart-svg" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" role="img">
    <defs>
      <linearGradient :id="gid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#6366f1" stop-opacity="0.28" />
        <stop offset="100%" stop-color="#6366f1" stop-opacity="0" />
      </linearGradient>
    </defs>

    <!-- Horizontal gridlines + y labels -->
    <g v-for="t in yTicks" :key="t.value">
      <line :x1="padL" :y1="t.y" :x2="W - padR" :y2="t.y" class="chart-grid" />
      <text :x="padL - 8" :y="t.y + 4" class="chart-axis" text-anchor="end">{{ t.label }}</text>
    </g>

    <!-- Area fill -->
    <path v-if="area" :d="areaPath" :fill="`url(#${gid})`" />

    <!-- Smooth line -->
    <path :d="linePath" class="chart-line" fill="none" />

    <!-- Endpoint dot -->
    <circle
      v-if="points.length"
      :cx="points[points.length - 1][0]"
      :cy="points[points.length - 1][1]"
      r="4"
      class="chart-dot"
    />

    <!-- X labels -->
    <text
      v-for="(label, i) in labels"
      :key="label"
      :x="xAt(i)"
      :y="H - 8"
      class="chart-axis"
      text-anchor="middle"
    >{{ label }}</text>
  </svg>
</template>

<style scoped>
.chart-svg {
  width: 100%;
  height: v-bind('height + "px"');
  display: block;
}
.chart-grid {
  stroke: var(--c-border);
  stroke-width: 1;
}
.chart-axis {
  fill: var(--c-text-faint);
  font-size: 12px;
  font-family: var(--font-sans);
}
.chart-line {
  stroke: #6366f1;
  stroke-width: 2.5;
  stroke-linecap: round;
}
.chart-dot {
  fill: #6366f1;
  stroke: var(--c-surface);
  stroke-width: 2;
}
</style>
