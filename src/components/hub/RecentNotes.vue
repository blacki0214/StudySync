<script setup>
/**
 * RecentNotes — the Hub's "pick up where you left off" list of the user's most
 * recently edited notes (already scoped to the signed-in user by contentStore).
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContentStore } from '../../stores/contentStore.js'
import { timeAgo } from '../../utils/formatDate.js'

const { t } = useI18n()
const content = useContentStore()

const notes = computed(() =>
  [...content.notes]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 4)
)
const subjectCode = (id) => content.subjectById(id)?.code || ''
</script>

<template>
  <div class="panel hub-widget">
    <div class="hub-widget-head">
      <div class="section-title section-title-flush"><i class="bi bi-journal-text"></i>{{ t('hub.recentNotes') }}</div>
      <router-link to="/notes" class="link-more">{{ t('common.viewAll') }}<i class="bi bi-chevron-right"></i></router-link>
    </div>

    <p v-if="!notes.length" class="hub-widget-empty">{{ t('hub.noNotes') }}</p>

    <router-link
      v-for="n in notes"
      :key="n.id"
      :to="{ name: 'note-detail', params: { id: n.id } }"
      class="hub-item"
    >
      <span class="hub-item-icon grad-blue"><i class="bi bi-file-earmark-text"></i></span>
      <div class="hub-item-body">
        <div class="hub-item-title">{{ n.title }}</div>
        <div class="hub-item-meta">
          <template v-if="subjectCode(n.subject_id)">{{ subjectCode(n.subject_id) }} · </template>{{ timeAgo(n.updated_at) }}
        </div>
      </div>
      <i class="bi bi-chevron-right hub-item-go"></i>
    </router-link>
  </div>
</template>
