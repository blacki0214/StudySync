<script setup>
/**
 * ProductTour — the first-run guidance flow. Two surfaces, both driven by
 * tourStore and mounted once in App.vue:
 *
 *   • The welcome dialog: a greeting with "Take the tour" / "Skip for now".
 *   • The spotlight tour: a dimmed overlay with a cut-out around the real
 *     element being explained, plus a card with the copy, progress dots and
 *     Back / Next / Skip.
 *
 * The dim is one transparent box with an enormous box-shadow spread — that
 * paints everything OUTSIDE the box and leaves the target crisp and unfiltered,
 * with no SVG mask and no need to re-stack the highlighted element.
 *
 * Placement is preference-plus-fallback: each step names the side it would like
 * the card on, and we fall back through the other sides until one fits, then
 * clamp to the viewport. A missing target degrades to a centered card rather
 * than a spotlight pointing at nothing.
 */
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTourStore } from '../../stores/tourStore.js'
import { useAuthStore } from '../../stores/authStore.js'
import logoMark from '../../assets/images/logo_2.png'

const tour = useTourStore()
const auth = useAuthStore()
const { t } = useI18n()

const PAD = 8 // breathing room between the target and the cut-out edge
const GAP = 14 // distance from the cut-out to the card
const EDGE = 16 // minimum distance from the viewport edge
const CARD_W = 336
const CENTER_W = 400

const holeStyle = ref(null) // null => no spotlight (centered card)
const cardStyle = ref({})
const arrowSide = ref('none') // which face of the card the arrow sits on
const arrowStyle = ref({})
const cardEl = ref(null)

const step = computed(() => tour.currentStep)
const firstName = computed(() => (auth.user?.full_name || '').split(' ')[0] || t('tour.there'))

const clamp = (v, min, max) => Math.max(min, Math.min(v, max))

/** Measure the target and paint the cut-out, then lay the card out beside it. */
async function place() {
  const s = step.value
  if (!s) return
  await nextTick()

  const el = s.target ? document.querySelector(s.target) : null
  if (!el) {
    // Target vanished (layout change, role without that nav item) — show the
    // copy centered instead of spotlighting empty space.
    holeStyle.value = null
    await nextTick()
    centerCard()
    return
  }

  // The sidebar scrolls, so a lower nav item may be out of view.
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' })

  const r = el.getBoundingClientRect()
  const hole = {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2
  }
  holeStyle.value = {
    top: `${hole.top}px`,
    left: `${hole.left}px`,
    width: `${hole.width}px`,
    height: `${hole.height}px`
  }

  await nextTick()
  layoutCard(hole, s.placement)
}

/** Pick the first side the card fits on, then clamp it into the viewport. */
function layoutCard(hole, preferred) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(CARD_W, vw - EDGE * 2)
  const h = cardEl.value?.offsetHeight || 200

  const fits = {
    right: hole.left + hole.width + GAP + w <= vw - EDGE,
    left: hole.left - GAP - w >= EDGE,
    bottom: hole.top + hole.height + GAP + h <= vh - EDGE,
    top: hole.top - GAP - h >= EDGE
  }
  const side = [preferred, 'right', 'bottom', 'top', 'left'].find((p) => fits[p]) || 'bottom'

  let top
  let left
  if (side === 'right' || side === 'left') {
    left = side === 'right' ? hole.left + hole.width + GAP : hole.left - GAP - w
    top = hole.top + hole.height / 2 - h / 2
  } else {
    top = side === 'bottom' ? hole.top + hole.height + GAP : hole.top - GAP - h
    left = hole.left + hole.width / 2 - w / 2
  }
  top = clamp(top, EDGE, Math.max(EDGE, vh - h - EDGE))
  left = clamp(left, EDGE, Math.max(EDGE, vw - w - EDGE))

  cardStyle.value = { top: `${top}px`, left: `${left}px`, width: `${w}px` }

  // The arrow lives on the face pointing BACK at the target, and slides along
  // that face so it still lines up after the card has been clamped.
  arrowSide.value = { right: 'left', left: 'right', bottom: 'top', top: 'bottom' }[side]
  if (side === 'right' || side === 'left') {
    arrowStyle.value = { top: `${clamp(hole.top + hole.height / 2 - top, 16, h - 16)}px` }
  } else {
    arrowStyle.value = { left: `${clamp(hole.left + hole.width / 2 - left, 16, w - 16)}px` }
  }
}

/** No target: centre the card like a modal. */
function centerCard() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(CENTER_W, vw - EDGE * 2)
  const h = cardEl.value?.offsetHeight || 220
  cardStyle.value = {
    top: `${clamp((vh - h) / 2, EDGE, Math.max(EDGE, vh - h - EDGE))}px`,
    left: `${(vw - w) / 2}px`,
    width: `${w}px`
  }
  arrowSide.value = 'none'
}

// Re-measure whenever the step changes, and while the page moves under us.
watch(() => [tour.active, tour.index], () => { if (tour.active) place() }, { flush: 'post' })

function reposition() {
  if (tour.active) place()
}

function onKeydown(e) {
  if (tour.welcomeOpen && e.key === 'Escape') { tour.skipTour(); return }
  if (!tour.active) return
  if (e.key === 'Escape') { e.preventDefault(); tour.skipTour() }
  else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); tour.next() }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); tour.back() }
}

// Freeze the page while a tour surface is open so the spotlight can't drift.
watch(() => tour.active || tour.welcomeOpen, (open) => {
  document.body.classList.toggle('tour-locked', Boolean(open))
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', reposition)
  window.addEventListener('scroll', reposition, true)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', reposition)
  window.removeEventListener('scroll', reposition, true)
  document.body.classList.remove('tour-locked')
})
</script>

<template>
  <!-- ---------- Welcome dialog (first run) ---------- -->
  <transition name="tour-fade">
    <div v-if="tour.welcomeOpen" class="tour-welcome-backdrop" role="dialog" aria-modal="true" :aria-label="t('tour.welcomeTitle', { name: firstName })">
      <div class="tour-welcome">
        <button class="tour-welcome-x" :aria-label="t('common.close')" @click="tour.skipTour()"><i class="bi bi-x-lg"></i></button>

        <div class="tw-mark"><img :src="logoMark" alt="" /></div>
        <h2 class="tw-title">{{ t('tour.welcomeTitle', { name: firstName }) }}</h2>
        <p class="tw-sub">{{ t('tour.welcomeSub') }}</p>

        <ul class="tw-points">
          <li><i class="bi bi-file-earmark-text"></i><span>{{ t('tour.welcomePoint1') }}</span></li>
          <li><i class="bi bi-stars"></i><span>{{ t('tour.welcomePoint2') }}</span></li>
          <li><i class="bi bi-people"></i><span>{{ t('tour.welcomePoint3') }}</span></li>
        </ul>

        <div class="tw-actions">
          <button class="btn btn-brand tw-primary" @click="tour.startTour()">
            <i class="bi bi-play-fill"></i>{{ t('tour.takeTour') }}
          </button>
          <button class="btn btn-outline-soft" @click="tour.skipTour()">{{ t('tour.skipForNow') }}</button>
        </div>
        <p class="tw-foot">{{ t('tour.replayHint') }}</p>
      </div>
    </div>
  </transition>

  <!-- ---------- Spotlight tour ---------- -->
  <transition name="tour-fade">
    <div v-if="tour.active" class="tour-root">
      <!-- The cut-out. Its giant box-shadow is what dims everything else, so the
           highlighted element stays perfectly sharp underneath. -->
      <div v-if="holeStyle" class="tour-hole" :style="holeStyle"></div>
      <div v-else class="tour-dim"></div>

      <div
        ref="cardEl"
        class="tour-card"
        :class="[`arrow-${arrowSide}`, { 'is-centered': arrowSide === 'none' }]"
        :style="cardStyle"
        role="dialog"
        aria-modal="true"
        :aria-label="step ? t(`tour.steps.${step.id}.title`) : ''"
      >
        <span v-if="arrowSide !== 'none'" class="tour-arrow" :style="arrowStyle"></span>

        <div class="tc-head">
          <span class="tc-icon"><i class="bi" :class="step?.icon"></i></span>
          <span class="tc-count">{{ tour.index + 1 }} / {{ tour.stepCount }}</span>
        </div>

        <h3 class="tc-title">{{ step ? t(`tour.steps.${step.id}.title`) : '' }}</h3>
        <p class="tc-body">{{ step ? t(`tour.steps.${step.id}.body`) : '' }}</p>

        <div class="tc-dots" role="tablist" :aria-label="t('tour.progress')">
          <button
            v-for="(s, i) in tour.steps"
            :key="s.id"
            class="tc-dot"
            :class="{ 'is-done': i < tour.index, 'is-active': i === tour.index }"
            :aria-label="t(`tour.steps.${s.id}.title`)"
            :aria-current="i === tour.index"
            @click="tour.goTo(i)"
          ></button>
        </div>

        <div class="tc-actions">
          <button class="tc-skip" @click="tour.skipTour()">{{ t('tour.skip') }}</button>
          <div class="tc-nav">
            <button v-if="!tour.isFirstStep" class="btn btn-outline-soft btn-sm" @click="tour.back()">
              {{ t('tour.back') }}
            </button>
            <button class="btn btn-brand btn-sm" @click="tour.next()">
              {{ tour.isLastStep ? t('tour.finish') : t('tour.next') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>
