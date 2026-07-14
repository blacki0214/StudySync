<script setup>
/**
 * FlashcardsDue — the Hub's review nudge: the user's decks that have cards due,
 * so they can jump straight into studying. Reads the per-user decks already
 * loaded in contentStore.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContentStore } from '../../stores/contentStore.js'

const { t } = useI18n()
const content = useContentStore()

const decks = computed(() =>
  [...content.decks].sort((a, b) => (b.due || 0) - (a.due || 0)).slice(0, 4)
)
const totalDue = computed(() => content.decks.reduce((s, d) => s + (d.due || 0), 0))
</script>

<template>
  <div class="panel hub-widget">
    <div class="hub-widget-head">
      <div class="section-title section-title-flush"><i class="bi bi-stars"></i>{{ t('hub.flashcardsDue') }}
        <span v-if="totalDue" class="badge-soft">{{ totalDue }}</span>
      </div>
      <router-link to="/flashcards" class="link-more">{{ t('common.viewAll') }}<i class="bi bi-chevron-right"></i></router-link>
    </div>

    <p v-if="!decks.length" class="hub-widget-empty">{{ t('hub.noDecks') }}</p>
    <p v-else-if="!totalDue" class="hub-widget-empty">{{ t('hub.noCardsDue') }}</p>

    <router-link
      v-for="d in decks"
      :key="d.id"
      to="/flashcards"
      class="hub-item"
    >
      <span class="hub-item-icon" :class="d.color || 'grad-orange'"><i class="bi bi-card-text"></i></span>
      <div class="hub-item-body">
        <div class="hub-item-title">{{ d.name }}</div>
        <div class="hub-item-meta">{{ t('flashcards.deckCards', { n: d.total }) }}</div>
      </div>
      <span class="hub-item-tag" :class="{ due: d.due > 0 }">{{ d.due > 0 ? t('hub.cardsDue', { n: d.due }) : t('hub.deckDone') }}</span>
    </router-link>
  </div>
</template>
