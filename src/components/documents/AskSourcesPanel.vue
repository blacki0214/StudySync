<script setup>
/**
 * AskSourcesPanel — extractive Q&A over the selected sources. It does NOT
 * generate text; it retrieves and cites the most relevant passages from your
 * documents (honest, LLM-free), using utils/sourceSearch.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { askSources } from '../../utils/sourceSearch.js'

const { t } = useI18n()
const props = defineProps({ docs: { type: Array, default: () => [] } })

const question = ref('')
const results = ref([])
const asked = ref(false)

function ask() {
  if (!question.value.trim()) return
  results.value = askSources(question.value, props.docs, { limit: 5 })
  asked.value = true
}
</script>

<template>
  <div class="panel ask-panel">
    <div class="section-title"><i class="bi bi-chat-left-quote"></i>{{ t('workspace.askTitle') }}</div>
    <p class="ask-hint">{{ t('workspace.askHint') }}</p>

    <div class="ask-input">
      <input
        v-model="question"
        class="form-control"
        :placeholder="t('workspace.askPlaceholder')"
        @keyup.enter="ask"
      />
      <button class="btn btn-brand btn-sm" :disabled="!docs.length" @click="ask"><i class="bi bi-search"></i></button>
    </div>

    <p v-if="!docs.length" class="doc-empty">{{ t('workspace.askNeedsSources') }}</p>

    <div v-else-if="asked" class="ask-results">
      <p v-if="!results.length" class="doc-empty">{{ t('workspace.askNoMatch') }}</p>
      <div v-for="(r, i) in results" :key="i" class="ask-result">
        <p class="ar-text">{{ r.text }}</p>
        <div class="ar-cite"><i class="bi bi-quote"></i>{{ r.source }}</div>
      </div>
    </div>
  </div>
</template>
