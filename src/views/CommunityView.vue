<script setup>
/**
 * CommunityView — Q&A feed with voting, filters, trending topics and top
 * contributors (matches the Figma). Votes are optimistic local state. Layout
 * uses row/col grid; all other styling is semantic classes in community.css.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { communityPosts, trendingTopics, topContributors } from '../data/sampleCommunity.js'
import { userById } from '../data/sampleUsers.js'
import { subjectByCode } from '../data/sampleSubjects.js'

const { t } = useI18n()
const filters = [
  { value: 'Hot', key: 'community.hot', icon: 'bi-fire' },
  { value: 'New', key: 'community.new' },
  { value: 'Top', key: 'community.top' },
  { value: 'My subjects', key: 'community.mySubjects' },
  { value: 'Unanswered', key: 'community.unanswered' }
]
const activeFilter = ref('Hot')
const posts = ref(communityPosts.map((p) => ({ ...p, voted: false })))

function vote(post) {
  post.voted = !post.voted
  post.votes += post.voted ? 1 : -1
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
        <button class="btn btn-brand"><i class="bi bi-plus-lg"></i>{{ t('community.newPost') }}</button>
      </header>

      <!-- Composer -->
      <div class="composer">
        <div class="cp-row">
          <span class="user-avatar composer-avatar">M</span>
          <input :placeholder="t('community.askPlaceholder')" />
        </div>
        <div class="cp-foot">
          <button class="btn btn-outline-soft btn-sm"><i class="bi bi-stars"></i>{{ t('community.ai') }}</button>
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
      <div v-for="post in posts" :key="post.id" class="post-card">
        <div class="vote-col">
          <button class="vote-btn" :class="{ voted: post.voted }" @click="vote(post)"><i class="bi bi-arrow-up"></i></button>
          <span class="vote-count">{{ post.votes }}</span>
        </div>
        <div class="post-body">
          <div class="post-head">
            <img v-if="userById(post.author_id)?.avatar" :src="userById(post.author_id).avatar" class="avatar-ring ph-avatar" :alt="post.author_id" />
            <span v-else class="user-avatar ph-avatar">{{ initials(userById(post.author_id)?.full_name) }}</span>
            <span class="ph-name">{{ userById(post.author_id)?.full_name }}</span>
            <span class="ph-meta">· {{ post.badge }} · {{ post.ago }}</span>
            <router-link
              v-if="subjectByCode(post.subject)"
              :to="{ name: 'subject-hub', params: { id: subjectByCode(post.subject).id } }"
              class="ph-subject badge-outline subject-chip-link"
            >{{ post.subject }}</router-link>
            <span v-else class="ph-subject badge-outline">{{ post.subject }}</span>
          </div>
          <div class="post-title" :class="{ answered: post.answered }">{{ post.title }}</div>
          <div class="post-excerpt">{{ post.excerpt }}</div>
          <div class="post-tags">
            <span v-for="t in post.tags" :key="t" class="badge-soft">{{ t }}</span>
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
        <div v-for="(topic, i) in trendingTopics" :key="topic.tag" class="trend-row">
          <span class="tr-rank">{{ i + 1 }}</span>
          <div>
            <div class="tr-tag">{{ topic.tag }}</div>
            <div class="tr-sub">{{ t('community.postsToday', { n: topic.posts }) }}</div>
          </div>
          <i class="bi bi-fire tr-fire"></i>
        </div>
      </div>

      <div class="panel">
        <div class="section-title"><i class="bi bi-trophy-fill"></i>{{ t('community.topContributors') }}</div>
        <div v-for="(c, i) in topContributors" :key="c.id" class="contrib-row">
          <span class="cr-rank">#{{ i + 1 }}</span>
          <img v-if="userById(c.id)?.avatar" :src="userById(c.id).avatar" class="avatar-ring cr-avatar" :alt="c.full_name" />
          <span v-else class="user-avatar cr-avatar">{{ initials(c.full_name) }}</span>
          <span class="cr-name">{{ c.full_name }}</span>
          <span class="cr-rep">{{ t('community.rep', { n: c.rep }) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
