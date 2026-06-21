<script setup>
/**
 * StudySummary — extractive summary of a note. Picks the 3–5 most important
 * sentences by keyword density (see textAnalyzer.extractKeySentences). No AI API.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { extractKeywords } from '../../utils/keywordExtractor.js'
import { extractKeySentences } from '../../utils/textAnalyzer.js'

const { t } = useI18n()
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
    <div class="section-title"><i class="bi bi-card-list"></i>{{ t('editor.summaryTitle') }}</div>

    <p v-if="!summary.length" class="tool-empty">{{ t('editor.summaryEmpty') }}</p>

    <ol v-else class="summary-list">
      <li v-for="(sentence, i) in summary" :key="i">{{ sentence }}</li>
    </ol>
  </div>
</template>
