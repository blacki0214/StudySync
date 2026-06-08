<script setup>
/**
 * StudySummary — extractive summary of a note. Picks the 3–5 most important
 * sentences by keyword density (see textAnalyzer.extractKeySentences). No AI API.
 */
import { computed } from 'vue'
import { extractKeywords } from '../../utils/keywordExtractor.js'
import { extractKeySentences } from '../../utils/textAnalyzer.js'

const props = defineProps({
  content: { type: String, default: '' },
  maxSentences: { type: Number, default: 4 }
})

const summary = computed(() => {
  const keywords = extractKeywords(props.content, { limit: 15 })
  return extractKeySentences(props.content, keywords, props.maxSentences)
})
</script>

<template>
  <div class="panel">
    <div class="section-title"><i class="bi bi-card-list"></i>Study summary</div>

    <p v-if="!summary.length" class="text-muted-sm mb-0">
      Write a few sentences and a key-point summary will appear here.
    </p>

    <ol v-else class="summary-list">
      <li v-for="(sentence, i) in summary" :key="i">{{ sentence }}</li>
    </ol>
  </div>
</template>
