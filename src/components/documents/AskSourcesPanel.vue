<script setup>
/**
 * AskSourcesPanel — Q&A over the selected sources.
 *
 * Two modes, chosen automatically by aiService:
 *  • AI on  (VITE_AI_ENABLED): retrieves the most relevant passages, then has
 *    Gemini write a GROUNDED answer with citations — and still shows the
 *    supporting passages underneath so the answer stays verifiable.
 *  • AI off: honest EXTRACTIVE retrieval only — the ranked passages, each cited
 *    back to its source document (no generation).
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isAiConfigured, askSources } from '../../services/aiService.js'

const { t } = useI18n()
const props = defineProps({ docs: { type: Array, default: () => [] } })

const question = ref('')
const answer = ref(null)
const citations = ref([])
const passages = ref([])
const asked = ref(false)
const asking = ref(false)

async function ask() {
  if (!question.value.trim()) return
  asking.value = true
  asked.value = true
  try {
    const r = await askSources(question.value, props.docs, { limit: 5 })
    answer.value = r.answer
    citations.value = r.citations || []
    passages.value = r.passages || []
  } catch {
    answer.value = ''
    citations.value = []
    passages.value = []
  } finally {
    asking.value = false
  }
}
</script>

<template>
  <div class="panel ask-panel">
    <div class="section-title">
      <i class="bi bi-chat-left-quote"></i>{{ t('workspace.askTitle') }}
      <span v-if="isAiConfigured" class="badge-soft ask-ai-badge"><i class="bi bi-stars"></i> AI</span>
    </div>
    <p class="ask-hint">{{ t('workspace.askHint') }}</p>

    <div class="ask-input">
      <input
        v-model="question"
        class="form-control"
        :placeholder="t('workspace.askPlaceholder')"
        @keyup.enter="ask"
      />
      <button class="btn btn-brand btn-sm" :disabled="!docs.length || asking" @click="ask">
        <i class="bi" :class="asking ? 'bi-arrow-repeat spin' : 'bi-search'"></i>
      </button>
    </div>

    <p v-if="!docs.length" class="doc-empty">{{ t('workspace.askNeedsSources') }}</p>

    <div v-else-if="asking" class="doc-empty"><i class="bi bi-arrow-repeat spin"></i> {{ t('workspace.askThinking') }}</div>

    <div v-else-if="asked" class="ask-results">
      <p v-if="!passages.length && !answer" class="doc-empty">{{ t('workspace.askNoMatch') }}</p>

      <!-- Generated, grounded answer (AI mode) -->
      <div v-if="answer" class="ask-answer">
        <div class="ask-answer-label"><i class="bi bi-robot"></i>{{ t('workspace.askAnswer') }}</div>
        <p class="ask-answer-text">{{ answer }}</p>
        <div v-if="citations.length" class="ask-citations">
          <span v-for="(c, i) in citations" :key="i" class="ar-cite"><i class="bi bi-quote"></i>{{ c.source }}</span>
        </div>
      </div>

      <!-- Supporting / extractive passages -->
      <div v-if="passages.length" class="ask-evidence">
        <div v-if="answer" class="ask-evidence-label">{{ t('workspace.askEvidence') }}</div>
        <div v-for="(r, i) in passages" :key="i" class="ask-result">
          <p class="ar-text">{{ r.text }}</p>
          <div class="ar-cite"><i class="bi bi-quote"></i>{{ r.source }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
