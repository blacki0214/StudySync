<script setup>
/**
 * KeywordExtractor — renders the top keywords from note content as a tag cloud.
 * Technical terms are highlighted. Pure rule-based extraction (no AI API).
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { extractKeywords } from '../../utils/keywordExtractor.js'

const { t } = useI18n()

const props = defineProps({
  content: { type: String, default: '' },
  limit: { type: Number, default: 12 }
})

const keywords = computed(() => extractKeywords(props.content, { limit: props.limit }))
</script>

<template>
  <div class="panel">
    <div class="section-title"><i class="bi bi-tags"></i>{{ t('keywords.title') }}</div>

    <p v-if="!keywords.length" class="kw-empty">{{ t('keywords.empty') }}</p>

    <div class="keyword-cloud">
      <span
        v-for="k in keywords"
        :key="k.word"
        class="keyword-tag"
        :class="{ 'is-technical': k.technical }"
        :title="k.technical ? 'Technical term' : 'Frequent term'"
      >
        {{ k.word }}<span class="kw-count">{{ k.count }}</span>
      </span>
    </div>

    <p class="kw-legend">
      <span class="keyword-tag is-technical kw-legend-chip">term</span>
      {{ t('keywords.legend') }}
    </p>
  </div>
</template>
