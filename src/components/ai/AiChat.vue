<script setup>
/**
 * AiChat — a small study-tutor chat (Gemini via aiService.chat). It passes the
 * current note as context so answers can reference what the student is reading.
 * Only meaningful when isAiConfigured is true; the parent guards rendering.
 */
import { ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { chat as aiChat } from '../../services/aiService.js'

const { t } = useI18n()
const props = defineProps({ context: { type: String, default: '' } })

const messages = ref([])
const input = ref('')
const sending = ref(false)
const listEl = ref(null)

async function scrollDown() {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return
  messages.value.push({ role: 'user', content: text })
  input.value = ''
  sending.value = true
  await scrollDown()
  try {
    const reply = await aiChat(messages.value, { context: props.context })
    messages.value.push({ role: 'assistant', content: reply || t('editor.chatError') })
  } catch {
    messages.value.push({ role: 'assistant', content: t('editor.chatError') })
  } finally {
    sending.value = false
    await scrollDown()
  }
}
</script>

<template>
  <div class="panel ai-chat">
    <div class="section-title"><i class="bi bi-robot"></i>{{ t('editor.chatTitle') }}</div>
    <div ref="listEl" class="ai-chat-log">
      <p v-if="!messages.length" class="tool-empty">{{ t('editor.chatEmpty') }}</p>
      <div v-for="(m, i) in messages" :key="i" class="ai-msg" :class="m.role">
        <div class="ai-msg-bubble">{{ m.content }}</div>
      </div>
      <div v-if="sending" class="ai-msg assistant"><div class="ai-msg-bubble ai-typing"><i class="bi bi-three-dots"></i></div></div>
    </div>
    <div class="ai-chat-input">
      <input
        v-model="input"
        class="form-control"
        :placeholder="t('editor.chatPlaceholder')"
        :disabled="sending"
        @keyup.enter="send"
      />
      <button class="btn btn-brand btn-sm" :disabled="sending || !input.trim()" @click="send"><i class="bi bi-send"></i></button>
    </div>
  </div>
</template>
