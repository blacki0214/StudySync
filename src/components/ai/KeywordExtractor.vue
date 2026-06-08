<script setup>
/**
 * KeywordExtractor — renders the top keywords from note content as a tag cloud.
 * Technical terms are highlighted. Pure rule-based extraction (no AI API).
 */
import { computed } from 'vue'
import { extractKeywords } from '../../utils/keywordExtractor.js'

const props = defineProps({
  content: { type: String, default: '' },
  limit: { type: Number, default: 12 }
})

const keywords = computed(() => extractKeywords(props.content, { limit: props.limit }))
</script>

<template>
  <div class="panel">
    <div class="section-title"><i class="bi bi-tags"></i>Key terms</div>

    <p v-if="!keywords.length" class="text-muted-sm mb-0">No keywords extracted yet.</p>

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

    <p class="text-muted-sm mt-3 mb-0">
      <span class="keyword-tag is-technical" style="padding:0.1rem 0.5rem">term</span>
      = detected technical term.
    </p>
  </div>
</template>
