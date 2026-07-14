<script setup>
/**
 * CommunityView — Q&A feed with voting, filters, replies, sharing, saving and
 * trending topics. Posting, voting, replying and saving are all REAL (Supabase
 * or demo/localStorage). The trending panel hides itself when there's nothing
 * to show; there is no "top contributors" leaderboard.
 */
import { ref, computed, onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContentStore } from '../stores/contentStore.js'
import { useAuthStore } from '../stores/authStore.js'
import { useDialogStore } from '../stores/dialogStore.js'
import { communityService } from '../services/communityService.js'

const { t } = useI18n()
const content = useContentStore()
const auth = useAuthStore()
const dialog = useDialogStore()
const userById = (id) => content.userById(id)
const subjectByCode = (code) => content.subjectByCode(code)

const filters = [
  { value: 'Hot', key: 'community.hot', icon: 'bi-fire' },
  { value: 'New', key: 'community.new' },
  { value: 'Top', key: 'community.top' },
  { value: 'My subjects', key: 'community.mySubjects' },
  { value: 'Unanswered', key: 'community.unanswered' },
  { value: 'Saved', key: 'community.saved' }
]
const activeFilter = ref('Hot')

// Which posts the current user has up-voted this session (optimistic UI).
const votedIds = ref(new Set())
// Post ids the user has saved (bookmarked), loaded from the backend.
const savedIds = ref(new Set())
// Per-post reply thread state: { [postId]: { open, loading, loaded, list, draft } }
const threads = reactive({})
const draft = ref('')
const posting = ref(false)
const askInput = ref(null)

onMounted(async () => {
  await content.ensureLoaded()
  savedIds.value = await communityService.listSavedIds(auth.user?.id)
})

const mySubjectCodes = computed(() =>
  content.subjects.filter((s) => s.owner_id && s.owner_id === auth.user?.id).map((s) => s.code)
)

const displayPosts = computed(() => {
  const list = [...content.posts]
  switch (activeFilter.value) {
    case 'Top':
      return list.sort((a, b) => (b.votes || 0) - (a.votes || 0))
    case 'Hot':
      return list.sort((a, b) => (b.votes || 0) + (b.replies || 0) - ((a.votes || 0) + (a.replies || 0)))
    case 'Unanswered':
      return list.filter((p) => !p.answered)
    case 'My subjects':
      return list.filter((p) => mySubjectCodes.value.includes(p.subject))
    case 'Saved':
      return list.filter((p) => savedIds.value.has(p.id))
    case 'New':
    default:
      return list // store keeps newest-first (created posts are unshifted)
  }
})

async function submitPost() {
  const text = draft.value.trim()
  if (!text) { askInput.value?.focus(); return }
  posting.value = true
  try {
    const [firstLine, ...rest] = text.split('\n')
    await content.createPost({ title: firstLine.trim(), excerpt: rest.join('\n').trim(), author: auth.user })
    draft.value = ''
    activeFilter.value = 'New'
    dialog.toast(t('community.posted'), 'success')
  } catch (e) {
    dialog.toast(e.message || 'Could not post. Please try again.', 'error')
  } finally {
    posting.value = false
  }
}

function vote(post) {
  const has = votedIds.value.has(post.id)
  if (has) { votedIds.value.delete(post.id); post.votes -= 1 }
  else { votedIds.value.add(post.id); post.votes += 1 }
  content.persistVotes(post.id, post.votes)
}
const hasVoted = (id) => votedIds.value.has(id)

// --- Replies -------------------------------------------------------------
function thread(postId) {
  if (!threads[postId]) threads[postId] = { open: false, loading: false, loaded: false, list: [], draft: '' }
  return threads[postId]
}
async function toggleReplies(post) {
  const th = thread(post.id)
  th.open = !th.open
  if (th.open && !th.loaded) {
    th.loading = true
    try {
      th.list = await communityService.listComments(post.id)
      th.loaded = true
    } catch { th.list = [] } finally { th.loading = false }
  }
}
async function submitReply(post) {
  const th = thread(post.id)
  const body = th.draft.trim()
  if (!body) return
  try {
    const comment = await communityService.addComment({
      postId: post.id, body, author: auth.user, newReplyCount: (post.replies || 0) + 1
    })
    th.list.push(comment)
    th.draft = ''
    post.replies = (post.replies || 0) + 1
  } catch {
    dialog.toast(t('community.replyFailed'), 'error')
  }
}
async function removeReply(post, comment) {
  const th = thread(post.id)
  try {
    await communityService.deleteComment({ id: comment.id, postId: post.id, newReplyCount: Math.max((post.replies || 1) - 1, 0) })
    th.list = th.list.filter((c) => c.id !== comment.id)
    post.replies = Math.max((post.replies || 1) - 1, 0)
  } catch {
    dialog.toast(t('community.replyFailed'), 'error')
  }
}

// --- Save / Share --------------------------------------------------------
const isSaved = (id) => savedIds.value.has(id)
async function toggleSave(post) {
  const next = !savedIds.value.has(post.id)
  const set = new Set(savedIds.value)
  next ? set.add(post.id) : set.delete(post.id)
  savedIds.value = set
  try {
    await communityService.toggleSave({ userId: auth.user?.id, postId: post.id, saved: next })
    dialog.toast(next ? t('community.saved_') : t('community.unsaved'), 'success')
  } catch {
    // Roll back on failure.
    const rb = new Set(savedIds.value)
    next ? rb.delete(post.id) : rb.add(post.id)
    savedIds.value = rb
    dialog.toast(t('community.saveFailed'), 'error')
  }
}
async function sharePost(post) {
  const url = `${window.location.origin}/community?post=${post.id}`
  try {
    await navigator.clipboard.writeText(url)
    dialog.toast(t('community.linkCopied'), 'success')
  } catch {
    dialog.toast(t('community.shareFailed'), 'error')
  }
}

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
  <div class="row g-4">
    <!-- Main column -->
    <div class="col-12 col-xl-8">
      <header class="page-head">
        <div>
          <h1 class="ph-title">{{ t('community.title') }}</h1>
          <p class="ph-sub">{{ t('community.sub') }}</p>
        </div>
        <button class="btn btn-brand" @click="askInput?.focus()"><i class="bi bi-plus-lg"></i>{{ t('community.newPost') }}</button>
      </header>

      <!-- Composer -->
      <div class="composer">
        <div class="cp-row">
          <img v-if="auth.user?.avatar" :src="auth.user.avatar" class="avatar-ring composer-avatar" alt="" />
          <span v-else class="user-avatar composer-avatar">{{ initials(auth.user?.full_name) }}</span>
          <textarea
            ref="askInput"
            v-model="draft"
            class="composer-input"
            rows="1"
            :placeholder="t('community.askPlaceholder')"
            @keydown.enter.exact.prevent="submitPost"
          ></textarea>
        </div>
        <div class="cp-foot">
          <span class="cp-hint">{{ t('community.composerHint') }}</span>
          <button class="btn btn-brand btn-sm" :disabled="posting || !draft.trim()" @click="submitPost">
            <i class="bi" :class="posting ? 'bi-arrow-repeat spin' : 'bi-send'"></i>{{ t('community.post') }}
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-pills">
        <button
          v-for="f in filters"
          :key="f.value"
          class="fp"
          :class="{ active: activeFilter === f.value }"
          @click="activeFilter = f.value"
        >
          <i v-if="f.icon" class="bi" :class="f.icon"></i>{{ t(f.key) }}
        </button>
      </div>

      <!-- Posts -->
      <div v-if="!displayPosts.length" class="community-empty">
        <i class="bi bi-chat-square-text"></i>
        <p>{{ t('community.emptyFilter') }}</p>
      </div>
      <div v-for="post in displayPosts" :key="post.id" class="post-card">
        <div class="vote-col">
          <button class="vote-btn" :class="{ voted: hasVoted(post.id) }" @click="vote(post)"><i class="bi bi-arrow-up"></i></button>
          <span class="vote-count">{{ post.votes }}</span>
        </div>
        <div class="post-body">
          <div class="post-head">
            <img v-if="userById(post.author_id)?.avatar" :src="userById(post.author_id).avatar" class="avatar-ring ph-avatar" :alt="post.author_id" />
            <span v-else class="user-avatar ph-avatar">{{ initials(userById(post.author_id)?.full_name) }}</span>
            <span class="ph-name">{{ userById(post.author_id)?.full_name || t('community.you') }}</span>
            <span class="ph-meta">· {{ post.badge }} · {{ post.ago }}</span>
            <router-link
              v-if="subjectByCode(post.subject)"
              :to="{ name: 'subject-hub', params: { id: subjectByCode(post.subject).id } }"
              class="ph-subject badge-outline subject-chip-link"
            >{{ post.subject }}</router-link>
            <span v-else-if="post.subject" class="ph-subject badge-outline">{{ post.subject }}</span>
          </div>
          <div class="post-title" :class="{ answered: post.answered }">{{ post.title }}</div>
          <div v-if="post.excerpt" class="post-excerpt">{{ post.excerpt }}</div>
          <div v-if="post.tags?.length" class="post-tags">
            <span v-for="tag in post.tags" :key="tag" class="badge-soft">{{ tag }}</span>
          </div>

          <!-- Actions -->
          <div class="post-foot">
            <button class="post-action" :class="{ active: thread(post.id).open }" @click="toggleReplies(post)">
              <i class="bi bi-chat"></i>{{ t('community.replies', { n: post.replies }) }}
            </button>
            <button class="post-action" @click="sharePost(post)"><i class="bi bi-share"></i>{{ t('community.share') }}</button>
            <button class="post-action" :class="{ active: isSaved(post.id) }" @click="toggleSave(post)">
              <i class="bi" :class="isSaved(post.id) ? 'bi-bookmark-fill' : 'bi-bookmark'"></i>{{ isSaved(post.id) ? t('community.saved_') : t('community.save') }}
            </button>
          </div>

          <!-- Reply thread -->
          <div v-if="thread(post.id).open" class="reply-thread">
            <p v-if="thread(post.id).loading" class="reply-loading"><i class="bi bi-arrow-repeat spin"></i> {{ t('community.loadingReplies') }}</p>
            <p v-else-if="!thread(post.id).list.length" class="reply-empty">{{ t('community.noReplies') }}</p>
            <div v-for="c in thread(post.id).list" :key="c.id" class="reply-row">
              <span class="user-avatar reply-avatar">{{ initials(c.author?.full_name) }}</span>
              <div class="reply-main">
                <div class="reply-meta"><span class="reply-name">{{ c.author?.full_name || t('community.you') }}</span><span class="reply-ago">· {{ c.ago }}</span></div>
                <div class="reply-body">{{ c.body }}</div>
              </div>
              <button v-if="c.author_id === auth.user?.id" class="reply-del" :title="t('community.delete')" @click="removeReply(post, c)"><i class="bi bi-trash"></i></button>
            </div>
            <div class="reply-composer">
              <input
                v-model="thread(post.id).draft"
                class="reply-input"
                :placeholder="t('community.replyPlaceholder')"
                @keydown.enter.exact.prevent="submitReply(post)"
              />
              <button class="btn btn-brand btn-sm" :disabled="!thread(post.id).draft.trim()" @click="submitReply(post)">
                <i class="bi bi-send"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right rail -->
    <div class="col-12 col-xl-4 community-rail">
      <div class="panel" v-if="content.trending?.length">
        <div class="section-title"><i class="bi bi-graph-up-arrow"></i>{{ t('community.trendingTopics') }}</div>
        <div v-for="(topic, i) in content.trending" :key="topic.tag" class="trend-row">
          <span class="tr-rank">{{ i + 1 }}</span>
          <div>
            <div class="tr-tag">{{ topic.tag }}</div>
            <div class="tr-sub">{{ t('community.postsToday', { n: topic.posts }) }}</div>
          </div>
          <i class="bi bi-fire tr-fire"></i>
        </div>
      </div>
    </div>
  </div>
</template>
