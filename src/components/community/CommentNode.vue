<script setup>
/**
 * CommentNode — a single Reddit-style threaded comment plus its nested replies
 * (rendered recursively). Emits `reply` ({ parentId, body }) and `delete` (id)
 * up to CommunityView, which owns the flat comment list and re-derives the tree.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  comment: { type: Object, required: true },
  currentUserId: { type: String, default: '' },
  depth: { type: Number, default: 0 }
})
const emit = defineEmits(['reply', 'delete'])
const { t } = useI18n()

const replying = ref(false)
const draft = ref('')

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
function send() {
  const body = draft.value.trim()
  if (!body) return
  emit('reply', { parentId: props.comment.id, body })
  draft.value = ''
  replying.value = false
}
</script>

<template>
  <div class="cnode" :class="{ nested: depth > 0 }">
    <div class="cnode-main">
      <span class="user-avatar cnode-avatar">{{ initials(comment.author?.full_name) }}</span>
      <div class="cnode-body">
        <div class="cnode-meta">
          <span class="cnode-name">{{ comment.author?.full_name || t('community.you') }}</span>
          <span class="cnode-ago">· {{ comment.ago }}</span>
        </div>
        <div class="cnode-text">{{ comment.body }}</div>
        <div class="cnode-actions">
          <button class="cnode-action" @click="replying = !replying"><i class="bi bi-reply"></i>{{ t('community.reply') }}</button>
          <button v-if="comment.author_id === currentUserId" class="cnode-action" @click="emit('delete', comment.id)"><i class="bi bi-trash"></i>{{ t('community.delete') }}</button>
        </div>

        <div v-if="replying" class="cnode-composer">
          <input
            v-model="draft"
            class="reply-input"
            :placeholder="t('community.replyPlaceholder')"
            @keydown.enter.exact.prevent="send"
          />
          <button class="btn btn-brand btn-sm" :disabled="!draft.trim()" @click="send"><i class="bi bi-send"></i></button>
        </div>
      </div>
    </div>

    <!-- Nested replies -->
    <div v-if="comment.children?.length" class="cnode-children">
      <CommentNode
        v-for="child in comment.children"
        :key="child.id"
        :comment="child"
        :current-user-id="currentUserId"
        :depth="depth + 1"
        @reply="emit('reply', $event)"
        @delete="emit('delete', $event)"
      />
    </div>
  </div>
</template>
