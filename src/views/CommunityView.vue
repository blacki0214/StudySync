<script setup>
/**
 * CommunityView — Q&A feed with voting, filters, trending topics and top
 * contributors. Posting and voting are REAL: new posts go through
 * contentStore.createPost (Supabase or demo) and votes persist via
 * contentStore.persistVotes. Layout uses row/col grid; other styling is
 * semantic classes in community.css.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContentStore } from '../stores/contentStore.js'
import { useAuthStore } from '../stores/authStore.js'
import { useDialogStore } from '../stores/dialogStore.js'

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
  { value: 'Unanswered', key: 'community.unanswered' }
]
const activeFilter = ref('Hot')

// Which posts the current user has up-voted this session (optimistic UI).
const votedIds = ref(new Set())
const draft = ref('')
const posting = ref(false)
const askInput = ref(null)

onMounted(() => content.ensureLoaded())

// The current user's subject codes, for the "My subjects" filter.
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
    // First line (or whole text) is the title; the rest is the body.
    const [firstLine, ...rest] = text.split('\n')
    await content.createPost({
      title: firstLine.trim(),
      excerpt: rest.join('\n').trim(),
      author: auth.user
    })
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
          <div class="post-foot">
            <span><i class="bi bi-chat"></i>{{ t('community.replies', { n: post.replies }) }}</span>
            <span><i class="bi bi-share"></i>{{ t('community.share') }}</span>
            <span><i class="bi bi-bookmark"></i>{{ t('community.save') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Right rail -->
    <div class="col-12 col-xl-4 community-rail">
      <div class="panel">
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

      <div class="panel" v-if="content.contributors?.length">
        <div class="section-title"><i class="bi bi-trophy"></i>{{ t('community.topContributors') }}</div>
        <div v-for="(c, i) in content.contributors" :key="c.id" class="contrib-row">
          <span class="cr-rank">{{ i + 1 }}</span>
          <span class="user-avatar cr-avatar">{{ initials(c.full_name) }}</span>
          <div class="cr-name">{{ c.full_name }}</div>
          <span class="cr-rep">{{ c.rep }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
