<script setup>
/**
 * HelpMenu — the floating "?" button and the popover behind it. This is the
 * permanent home for guidance once the first-run tour is over: replay the tour,
 * bring back the Get-started checklist, or open the Help centre on the FAQ,
 * support or feedback tab.
 *
 * The button carries data-tour="help" so the tour itself can point at it and
 * tell the user this is where to come back to.
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTourStore } from '../../stores/tourStore.js'

const tour = useTourStore()
const { t } = useI18n()

const open = ref(false)
const root = ref(null)

const items = [
  { key: 'tour', icon: 'bi-play-circle', label: 'help.menuTour', hint: 'help.menuTourHint', run: () => tour.startTour() },
  { key: 'checklist', icon: 'bi-check2-square', label: 'help.menuChecklist', hint: 'help.menuChecklistHint', run: () => tour.showChecklist() },
  { key: 'faq', icon: 'bi-question-circle', label: 'help.menuFaq', hint: 'help.menuFaqHint', run: () => tour.openHelp('faq') },
  { key: 'support', icon: 'bi-life-preserver', label: 'help.menuSupport', hint: 'help.menuSupportHint', run: () => tour.openHelp('support') },
  { key: 'feedback', icon: 'bi-chat-heart', label: 'help.menuFeedback', hint: 'help.menuFeedbackHint', run: () => tour.openHelp('feedback') }
]

function pick(item) {
  open.value = false
  item.run()
}

// Close on outside click / Escape, like the other popovers in the app.
function onDocClick(e) {
  if (open.value && root.value && !root.value.contains(e.target)) open.value = false
}
function onKey(e) {
  if (open.value && e.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="help-menu-root">
    <transition name="help-pop">
      <div v-if="open" class="help-menu" role="menu" :aria-label="t('help.menuTitle')">
        <div class="help-menu-head">{{ t('help.menuTitle') }}</div>
        <button
          v-for="item in items"
          :key="item.key"
          class="help-menu-item"
          role="menuitem"
          @click="pick(item)"
        >
          <i class="bi" :class="item.icon"></i>
          <span class="hmi-text">
            <span class="hmi-label">{{ t(item.label) }}</span>
            <span class="hmi-hint">{{ t(item.hint) }}</span>
          </span>
        </button>
      </div>
    </transition>

    <button
      class="fab-help"
      data-tour="help"
      :class="{ 'is-open': open }"
      :aria-label="t('help.menuTitle')"
      :aria-expanded="open"
      :title="t('help.menuTitle')"
      @click="open = !open"
    >
      <i class="bi" :class="open ? 'bi-x-lg' : 'bi-question-lg'"></i>
    </button>
  </div>
</template>
