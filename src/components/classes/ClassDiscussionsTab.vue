<script setup>
/**
 * ClassDiscussionsTab — a class-private Q&A (Phase 5). Any member starts a
 * thread and replies; teachers answer. Lightweight threaded list.
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/authStore.js'
import { classActivityService } from '../../services/classActivityService.js'
import { timeAgo } from '../../utils/formatDate.js'
import EmptyState from '../common/EmptyState.vue'

const props = defineProps({ classId: { type: String, required: true } })
const { t } = useI18n()
const auth = useAuthStore()

const threads = ref([])
const openId = ref(null)
const replies = ref([])
const composer = ref({ title: '', body: '' })
const replyDraft = ref('')
const showComposer = ref(false)

onMounted(load)
async function load() { threads.value = await classActivityService.listThreads(props.classId) }

function initials(name) { return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() }

async function post() {
  if (!composer.value.title.trim()) return
  await classActivityService.createThread({
    classId: props.classId, authorId: auth.user?.id, authorName: auth.user?.full_name,
    title: composer.value.title, body: composer.value.body
  })
  composer.value = { title: '', body: '' }
  showComposer.value = false
  await load()
}
async function openThread(th) {
  if (openId.value === th.id) { openId.value = null; return }
  openId.value = th.id
  replies.value = await classActivityService.listReplies(th.id)
}
async function reply(th) {
  if (!replyDraft.value.trim()) return
  await classActivityService.addReply({ threadId: th.id, authorId: auth.user?.id, authorName: auth.user?.full_name, body: replyDraft.value })
  replyDraft.value = ''
  replies.value = await classActivityService.listReplies(th.id)
  const t2 = threads.value.find((x) => x.id === th.id); if (t2) t2.reply_count = (t2.reply_count || 0) + 1
}
</script>

<template>
  <div>
    <div class="tab-toolbar">
      <button class="btn btn-brand btn-sm" @click="showComposer = !showComposer"><i class="bi bi-plus-lg"></i>{{ t('discuss.newThread') }}</button>
    </div>

    <div v-if="showComposer" class="disc-composer">
      <input v-model="composer.title" class="form-control" :placeholder="t('discuss.titlePlaceholder')" />
      <textarea v-model="composer.body" class="form-control" rows="2" :placeholder="t('discuss.bodyPlaceholder')"></textarea>
      <div class="disc-composer-actions">
        <button class="btn btn-soft btn-sm" @click="showComposer = false">{{ t('common.cancel') }}</button>
        <button class="btn btn-brand btn-sm" :disabled="!composer.title.trim()" @click="post">{{ t('discuss.post') }}</button>
      </div>
    </div>

    <EmptyState v-if="!threads.length" icon="bi-chat-square-text" :title="t('discuss.none')" :message="t('discuss.noneMsg')" />
    <div v-else class="disc-list">
      <div v-for="th in threads" :key="th.id" class="disc-thread">
        <button class="disc-thread-head" @click="openThread(th)">
          <span class="disc-avatar">{{ initials(th.author?.full_name) }}</span>
          <span class="disc-main">
            <span class="disc-title">{{ th.title }}</span>
            <span class="disc-meta">{{ th.author?.full_name }} · {{ timeAgo(th.created_at) }} · {{ t('discuss.replyCount', { n: th.reply_count || 0 }) }}</span>
          </span>
          <i class="bi" :class="openId === th.id ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
        </button>

        <div v-if="openId === th.id" class="disc-detail">
          <p v-if="th.body" class="disc-body">{{ th.body }}</p>
          <div v-for="r in replies" :key="r.id" class="disc-reply">
            <span class="disc-avatar sm">{{ initials(r.author?.full_name) }}</span>
            <div>
              <div class="disc-reply-meta"><strong>{{ r.author?.full_name }}</strong> · {{ timeAgo(r.created_at) }}</div>
              <div class="disc-reply-body">{{ r.body }}</div>
            </div>
          </div>
          <div class="disc-reply-composer">
            <input v-model="replyDraft" class="form-control" :placeholder="t('discuss.replyPlaceholder')" @keyup.enter="reply(th)" />
            <button class="btn btn-brand btn-sm" :disabled="!replyDraft.trim()" @click="reply(th)">{{ t('discuss.reply') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.disc-composer { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius); padding: var(--space-4); margin-bottom: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
.disc-composer-actions { display: flex; justify-content: flex-end; gap: var(--space-2); }
.disc-list { display: flex; flex-direction: column; gap: var(--space-3); }
.disc-thread { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius); overflow: hidden; }
.disc-thread-head { display: flex; align-items: center; gap: var(--space-3); width: 100%; border: none; background: none; padding: var(--space-3) var(--space-4); cursor: pointer; text-align: left; color: var(--c-text); }
.disc-thread-head:hover { background: var(--c-surface-2); }
.disc-avatar { width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center; background: var(--grad-brand); color: #fff; font-size: 0.72rem; font-weight: 700; }
.disc-avatar.sm { width: 28px; height: 28px; font-size: 0.66rem; }
.disc-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.disc-title { font-weight: 700; font-size: 0.95rem; }
.disc-meta { font-size: 0.76rem; color: var(--c-text-faint); }
.disc-detail { padding: 0 var(--space-4) var(--space-4); border-top: 1px solid var(--c-border); }
.disc-body { margin: var(--space-3) 0; color: var(--c-text-muted); }
.disc-reply { display: flex; gap: var(--space-2); padding: var(--space-2) 0; }
.disc-reply-meta { font-size: 0.8rem; }
.disc-reply-body { font-size: 0.9rem; }
.disc-reply-composer { display: flex; gap: var(--space-2); margin-top: var(--space-2); }
</style>
