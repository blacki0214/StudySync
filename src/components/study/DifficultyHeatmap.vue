<script setup>
/**
 * DifficultyHeatmap — visualises the four signals the difficultyAnalyzer uses
 * (sentence length, technical terms, long-word ratio, length) as horizontal
 * bars, plus the overall level + explanation. Makes the "manual AI" reasoning
 * transparent to the user.
 */
import { computed } from 'vue'

const props = defineProps({
  analysis: { type: Object, required: true } // output of analyzeDifficulty()
})

// Map each raw metric to a 0..100 bar width using the same ceilings as the
// analyzer, so the bars mirror how the score was actually computed.
const rows = computed(() => {
  const m = props.analysis.metrics
  return [
    { label: 'Sentence length', pct: Math.min((m.avgSentenceLength / 25) * 100, 100), raw: m.avgSentenceLength.toFixed(1) },
    { label: 'Technical terms', pct: Math.min((m.technicalCount / 8) * 100, 100), raw: m.technicalCount },
    { label: 'Long words', pct: Math.min((m.longWordRatio / 0.25) * 100, 100), raw: `${Math.round(m.longWordRatio * 100)}%` },
    { label: 'Content length', pct: Math.min((m.totalWords / 250) * 100, 100), raw: `${m.totalWords}w` }
  ]
})

function barColor(pct) {
  if (pct < 40) return 'var(--c-easy)'
  if (pct < 70) return 'var(--c-medium)'
  return 'var(--c-hard)'
}
</script>

<template>
  <div class="panel">
    <div class="section-title">
      <i class="bi bi-bar-chart-steps"></i>Difficulty analysis
      <span class="difficulty-pill ms-auto" :class="`difficulty-${analysis.level}`">{{ analysis.level }}</span>
    </div>

    <div class="heatmap">
      <div v-for="row in rows" :key="row.label" class="heatmap-row">
        <span class="hm-label">{{ row.label }}</span>
        <div class="heatmap-bar">
          <div class="hm-fill" :style="{ width: row.pct + '%', background: barColor(row.pct) }"></div>
        </div>
        <span class="hm-value">{{ row.raw }}</span>
      </div>
    </div>

    <p class="text-muted-sm mt-3 mb-0"><i class="bi bi-lightbulb me-1"></i>{{ analysis.explanation }}</p>
  </div>
</template>
