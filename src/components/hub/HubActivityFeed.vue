<script setup>
/**
 * HubActivityFeed — a unified, cross-feature stream (notes, rooms, community,
 * flashcards) so the Hub shows everything happening in one place. Each row's
 * text is translated from the event's i18n key and links into its feature.
 */
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContentStore } from '../../stores/contentStore.js'

const { t } = useI18n()
const content = useContentStore()
onMounted(() => content.ensureLoaded())

function actorName(id) {
  return content.userById(id)?.full_name || 'Someone'
}
</script>

<template>
  <div class="panel hub-activity">
    <div class="section-title"><i class="bi bi-activity"></i>{{ t('hub.recentActivity') }}</div>

    <router-link
      v-for="a in content.activities"
      :key="a.id"
      :to="a.to"
      class="activity-row"
    >
      <span class="activity-icon" :style="{ background: a.color }"><i class="bi" :class="a.icon"></i></span>
      <div class="activity-text">
        <div>{{ t(a.key, { user: actorName(a.actorId), ...a.params }) }}</div>
        <div class="activity-ago">{{ a.ago }}</div>
      </div>
    </router-link>
  </div>
</template>
