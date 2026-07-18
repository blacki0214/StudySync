<script setup>
/**
 * ClassSlidesTab — the class's slide decks (Phase 3). Teacher/TA creates a deck
 * (opens the native editor); every member can open one to view/present.
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/authStore.js'
import { useDialogStore } from '../../stores/dialogStore.js'
import { slideService } from '../../services/slideService.js'
import EmptyState from '../common/EmptyState.vue'

const props = defineProps({
  classId: { type: String, required: true },
  canManage: { type: Boolean, default: false }
})
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const dialog = useDialogStore()

const decks = ref([])
const creating = ref(false)

onMounted(async () => { decks.value = await slideService.listDecks(props.classId) })

async function create() {
  const title = await dialog.promptText({ title: t('slides.newDeck'), label: t('slides.deckTitle'), placeholder: t('slides.deckPlaceholder') })
  if (!title || !title.trim()) return
  creating.value = true
  try {
    const deck = await slideService.createDeck({ classId: props.classId, title: title.trim(), ownerId: auth.user?.id })
    router.push({ name: 'slide-editor', params: { deckId: deck.id } })
  } catch (e) {
    // Most likely the slide_decks table doesn't exist yet (run the migration).
    dialog.toast(e.message || t('slides.createFailed'), 'error')
  } finally { creating.value = false }
}
async function remove(deck) {
  const ok = await dialog.confirm({ message: t('slides.deleteDeckConfirm', { name: deck.title }), danger: true })
  if (!ok) return
  await slideService.deleteDeck(deck.id)
  decks.value = decks.value.filter((d) => d.id !== deck.id)
}
</script>

<template>
  <div>
    <div v-if="canManage" class="tab-toolbar">
      <button class="btn btn-brand btn-sm" :disabled="creating" @click="create"><i class="bi bi-plus-lg"></i>{{ t('slides.newDeck') }}</button>
    </div>

    <EmptyState v-if="!decks.length" icon="bi-easel" :title="t('slides.noDecks')" :message="t('slides.noDecksMsg')" />
    <div v-else class="row g-4">
      <div v-for="d in decks" :key="d.id" class="col-12 col-md-6 col-xl-4">
        <div class="class-card slide-deck-card">
          <router-link :to="{ name: 'slide-editor', params: { deckId: d.id } }" class="sdc-open">
            <span class="icon-tile grad-fuchsia"><i class="bi bi-easel"></i></span>
            <div class="class-name">{{ d.title }}</div>
            <div class="class-desc">{{ t('slides.slideCount', { n: (d.slides ? d.slides.length : 1) }) }}</div>
          </router-link>
          <button v-if="canManage" class="sdc-del" :title="t('slides.deleteDeck')" @click="remove(d)"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-deck-card { position: relative; }
.sdc-open { display: block; color: inherit; text-decoration: none; }
.sdc-open:hover { text-decoration: none; color: inherit; }
.sdc-del { position: absolute; top: var(--space-3); right: var(--space-3); border: none; background: var(--c-surface-2); color: var(--c-text-faint); width: 30px; height: 30px; border-radius: 8px; cursor: pointer; }
.sdc-del:hover { color: var(--c-danger); }
</style>
