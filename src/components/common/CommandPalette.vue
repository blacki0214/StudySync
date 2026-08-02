<script setup>
/**
 * CommandPalette — the global ⌘K launcher. Searches across notes, subjects,
 * rooms, decks and community posts, AND offers quick-action commands (new note,
 * start room, generate flashcards, toggle theme, switch language, go to any
 * page). Arrow keys move the selection, Enter runs it, Esc closes.
 *
 * Open-state is shared via paletteStore; the global keydown that opens it lives
 * in App.vue. The searchable index + keyboard nav are local to this component.
 */
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { usePaletteStore } from '../../stores/paletteStore.js'
import { useUiStore } from '../../stores/uiStore.js'
import { useSubjectStore } from '../../stores/subjectStore.js'
import { useContentStore } from '../../stores/contentStore.js'
import { SUPPORTED, setLocale } from '../../i18n/index.js'

const palette = usePaletteStore()
const ui = useUiStore()
const subjectStore = useSubjectStore()
const content = useContentStore()
const router = useRouter()
const { t } = useI18n()

const query = ref('')
const activeIndex = ref(0)
const inputRef = ref(null)

// Section order + translated headers.
const SECTIONS = ['actions', 'notes', 'subjects', 'rooms', 'decks', 'community']
const sectionLabel = (type) => t(`palette.section.${type}`)

function go(to) {
  router.push(to)
  palette.hide()
}

// The full searchable index, rebuilt reactively. Each entry runs an action.
const index = computed(() => {
  const entries = []

  // Quick actions / navigation commands.
  entries.push(
    { type: 'actions', icon: 'bi-plus-lg', label: t('hub.newNote'), run: () => go('/notes') },
    { type: 'actions', icon: 'bi-stars', label: t('hub.generateFlashcards'), run: () => go('/flashcards') },
    { type: 'actions', icon: 'bi-camera-video', label: t('hub.joinRoom'), run: () => go('/rooms') },
    { type: 'actions', icon: 'bi-chat-square-text', label: t('hub.askCommunity'), run: () => go('/community') },
    { type: 'actions', icon: ui.isDark ? 'bi-sun' : 'bi-moon', label: ui.isDark ? t('nav.lightMode') : t('nav.darkMode'), run: () => { ui.toggleTheme(); palette.hide() } }
  )
  SUPPORTED.forEach((l) =>
    entries.push({ type: 'actions', icon: 'bi-translate', label: `${t('nav.language')}: ${l.label}`, run: () => { setLocale(l.code); palette.hide() } })
  )
  // Go-to each page.
  ;[
    { icon: 'bi-compass', label: t('nav.hub'), to: '/hub' },
    { icon: 'bi-journal-bookmark', label: t('nav.subjects'), to: '/subjects' },
    { icon: 'bi-file-earmark-text', label: t('nav.collabNotes'), to: '/notes' },
    { icon: 'bi-check2-square', label: t('nav.tasks'), to: '/tasks' },
    { icon: 'bi-calendar-week', label: t('nav.schedule'), to: '/schedule' },
    { icon: 'bi-people', label: t('nav.studyRooms'), to: '/rooms' },
    { icon: 'bi-gear', label: t('nav.settings'), to: '/settings' }
  ].forEach((p) => entries.push({ type: 'actions', icon: p.icon, label: p.label, sublabel: t('palette.goTo'), run: () => go(p.to) }))

  // Searchable entities (sourced from the DB in live mode, samples in demo mode).
  content.notes.forEach((n) =>
    entries.push({ type: 'notes', icon: 'bi-file-earmark-text', label: n.title, sublabel: subjectStore.getById(n.subject_id)?.code, run: () => go({ name: 'note-detail', params: { id: n.id } }) })
  )
  subjectStore.subjects.forEach((s) =>
    entries.push({ type: 'subjects', icon: 'bi-journal-bookmark', label: `${s.code} · ${s.name}`, sublabel: s.category, run: () => go({ name: 'subject-hub', params: { id: s.id } }) })
  )
  content.rooms.forEach((r) =>
    entries.push({ type: 'rooms', icon: 'bi-people', label: r.name, sublabel: r.code, run: () => go({ name: 'study-room', params: { id: r.id } }) })
  )
  content.decks.forEach((d) =>
    entries.push({ type: 'decks', icon: 'bi-stars', label: d.name, sublabel: d.subject, run: () => go('/flashcards') })
  )
  content.posts.forEach((p) =>
    entries.push({ type: 'community', icon: 'bi-chat-square-text', label: p.title, sublabel: p.subject, run: () => go('/community') })
  )

  return entries
})

// Filtered flat list (group order preserved), used for keyboard nav.
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  const matched = q
    ? index.value.filter(
        (e) => e.label.toLowerCase().includes(q) || (e.sublabel || '').toLowerCase().includes(q)
      )
    : index.value
  // Stable order by section.
  return [...matched].sort((a, b) => SECTIONS.indexOf(a.type) - SECTIONS.indexOf(b.type))
})

// Group for display while keeping each item's flat index for highlighting.
const grouped = computed(() =>
  SECTIONS.map((type) => ({ type, items: results.value.filter((e) => e.type === type) })).filter(
    (g) => g.items.length
  )
)

function flatIndex(item) {
  return results.value.indexOf(item)
}

function move(delta) {
  if (!results.value.length) return
  activeIndex.value = (activeIndex.value + delta + results.value.length) % results.value.length
}
function runActive() {
  results.value[activeIndex.value]?.run()
}

// Reset + focus whenever the palette opens; reset selection as the query changes.
watch(
  () => palette.open,
  async (isOpen) => {
    if (isOpen) {
      // The palette is global; make sure the searchable data is loaded.
      if (!subjectStore.subjects.length) subjectStore.fetchSubjects()
      content.ensureLoaded()
      query.value = ''
      activeIndex.value = 0
      await nextTick()
      inputRef.value?.focus()
    }
  }
)
watch(query, () => (activeIndex.value = 0))
</script>

<template>
  <transition name="palette">
    <div v-if="palette.open" class="palette-wrap" @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.enter.prevent="runActive" @keydown.esc="palette.hide()">
      <button class="palette-backdrop" :aria-label="t('common.cancel')" @click="palette.hide()"></button>

      <div class="palette" role="dialog" aria-modal="true">
        <div class="palette-input">
          <i class="bi bi-search"></i>
          <input ref="inputRef" v-model="query" :placeholder="t('palette.placeholder')" />
          <span class="kbd">Esc</span>
          <!-- Phones have no Esc key: a tappable close button instead (CSS shows
               it only on mobile, where the palette goes full-screen). -->
          <button class="palette-close" :aria-label="t('common.cancel')" @click="palette.hide()">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <div class="palette-results">
          <p v-if="!results.length" class="palette-empty">{{ t('palette.empty') }}</p>

          <div v-for="group in grouped" :key="group.type" class="palette-group">
            <div class="palette-group-head">{{ sectionLabel(group.type) }}</div>
            <button
              v-for="item in group.items"
              :key="flatIndex(item)"
              class="palette-item"
              :class="{ active: flatIndex(item) === activeIndex }"
              @mouseenter="activeIndex = flatIndex(item)"
              @click="item.run()"
            >
              <i class="bi palette-item-icon" :class="item.icon"></i>
              <span class="palette-item-label">{{ item.label }}</span>
              <span v-if="item.sublabel" class="palette-item-sub">{{ item.sublabel }}</span>
            </button>
          </div>
        </div>

        <div class="palette-foot">
          <span><span class="kbd">↑</span><span class="kbd">↓</span> {{ t('palette.navigate') }}</span>
          <span><span class="kbd">↵</span> {{ t('palette.select') }}</span>
        </div>
      </div>
    </div>
  </transition>
</template>
