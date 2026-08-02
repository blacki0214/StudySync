<script setup>
/**
 * HelpCenter — the modal behind the "?" menu. Three tabs:
 *
 *   • FAQ      — an accordion of the questions new users actually ask.
 *   • Support  — how to reach a human, plus the details worth quoting.
 *   • Feedback — a short form that writes to the `feedback` table (or to
 *                localStorage in demo mode; see feedbackService).
 *
 * Opened from anywhere via tourStore.openHelp('faq' | 'support' | 'feedback').
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useTourStore } from '../../stores/tourStore.js'
import { useAuthStore } from '../../stores/authStore.js'
import { useDialogStore } from '../../stores/dialogStore.js'
import { feedbackService } from '../../services/feedbackService.js'

const tour = useTourStore()
const auth = useAuthStore()
const dialog = useDialogStore()
const route = useRoute()
const { t } = useI18n()

// Where "email us" points. Override per deployment with VITE_SUPPORT_EMAIL.
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@studysync.vn'

const tabs = [
  { key: 'faq', icon: 'bi-question-circle', label: 'help.tabFaq' },
  { key: 'support', icon: 'bi-life-preserver', label: 'help.tabSupport' },
  { key: 'feedback', icon: 'bi-chat-heart', label: 'help.tabFeedback' }
]

// FAQ entries — copy lives at help.faq.<id>.q / .a so both locales stay in sync.
const FAQ_IDS = ['start', 'notes', 'ai', 'flashcards', 'tasks', 'rooms', 'classes', 'privacy', 'shortcuts']
const openFaq = ref('start')
function toggleFaq(id) {
  openFaq.value = openFaq.value === id ? null : id
}

// --- Feedback form ---------------------------------------------------------
const KINDS = ['bug', 'idea', 'question', 'other']
const kind = ref('idea')
const message = ref('')
const replyEmail = ref('')
const sending = ref(false)

const canSend = computed(() => message.value.trim().length >= 5 && !sending.value)

async function sendFeedback() {
  if (!canSend.value) return
  sending.value = true
  try {
    await feedbackService.submit({
      userId: auth.user?.id || null,
      kind: kind.value,
      message: message.value,
      email: replyEmail.value.trim() || auth.user?.email || null,
      page: route.fullPath
    })
    message.value = ''
    replyEmail.value = ''
    dialog.toast(t('help.feedbackThanks'), 'success')
    tour.closeHelp()
  } catch (e) {
    dialog.toast(e.message || t('help.feedbackFailed'), 'error')
  } finally {
    sending.value = false
  }
}

// Jump straight to a bug report when Support hands off to the form.
function reportBug() {
  kind.value = 'bug'
  tour.helpTab = 'feedback'
}

const mailtoHref = computed(() => {
  const subject = encodeURIComponent(t('help.mailSubject'))
  const body = encodeURIComponent(`${t('help.mailBody')}\n\n---\n${route.fullPath} · ${auth.user?.email || '—'}`)
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`
})

function onKey(e) {
  if (tour.helpOpen && e.key === 'Escape') tour.closeHelp()
}
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))

// Reset the accordion each time the modal opens so it never reopens scrolled.
watch(() => tour.helpOpen, (open) => { if (open) openFaq.value = 'start' })
</script>

<template>
  <transition name="tour-fade">
    <div v-if="tour.helpOpen" class="help-backdrop" @click.self="tour.closeHelp()">
      <div class="help-panel" role="dialog" aria-modal="true" :aria-label="t('help.title')">
        <header class="help-head">
          <div>
            <h2 class="help-title">{{ t('help.title') }}</h2>
            <p class="help-sub">{{ t('help.subtitle') }}</p>
          </div>
          <button class="help-x" :aria-label="t('common.close')" @click="tour.closeHelp()"><i class="bi bi-x-lg"></i></button>
        </header>

        <nav class="help-tabs" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="help-tab"
            :class="{ 'is-active': tour.helpTab === tab.key }"
            role="tab"
            :aria-selected="tour.helpTab === tab.key"
            @click="tour.helpTab = tab.key"
          >
            <i class="bi" :class="tab.icon"></i>{{ t(tab.label) }}
          </button>
        </nav>

        <div class="help-body">
          <!-- ---------- FAQ ---------- -->
          <div v-if="tour.helpTab === 'faq'" class="help-faq">
            <div v-for="id in FAQ_IDS" :key="id" class="faq-item" :class="{ 'is-open': openFaq === id }">
              <button class="faq-q" :aria-expanded="openFaq === id" @click="toggleFaq(id)">
                <span>{{ t(`help.faq.${id}.q`) }}</span>
                <i class="bi bi-chevron-down faq-caret"></i>
              </button>
              <p v-if="openFaq === id" class="faq-a">{{ t(`help.faq.${id}.a`) }}</p>
            </div>

            <button class="faq-tour-cta" @click="tour.startTour()">
              <i class="bi bi-play-circle"></i>
              <span>
                <strong>{{ t('help.menuTour') }}</strong>
                <small>{{ t('help.menuTourHint') }}</small>
              </span>
              <i class="bi bi-chevron-right"></i>
            </button>
          </div>

          <!-- ---------- Support ---------- -->
          <div v-else-if="tour.helpTab === 'support'" class="help-support">
            <p class="help-lead">{{ t('help.supportLead') }}</p>

            <a class="support-card" :href="mailtoHref">
              <span class="sc-icon grad-blue"><i class="bi bi-envelope"></i></span>
              <span class="sc-text">
                <strong>{{ t('help.supportEmail') }}</strong>
                <small>{{ SUPPORT_EMAIL }}</small>
              </span>
              <i class="bi bi-box-arrow-up-right sc-go"></i>
            </a>

            <button class="support-card" @click="reportBug">
              <span class="sc-icon grad-orange"><i class="bi bi-bug"></i></span>
              <span class="sc-text">
                <strong>{{ t('help.supportBug') }}</strong>
                <small>{{ t('help.supportBugHint') }}</small>
              </span>
              <i class="bi bi-chevron-right sc-go"></i>
            </button>

            <button class="support-card" @click="tour.startTour()">
              <span class="sc-icon grad-fuchsia"><i class="bi bi-compass"></i></span>
              <span class="sc-text">
                <strong>{{ t('help.supportTour') }}</strong>
                <small>{{ t('help.supportTourHint') }}</small>
              </span>
              <i class="bi bi-chevron-right sc-go"></i>
            </button>

            <div class="support-meta">
              <div class="help-lead-label">{{ t('help.supportDetails') }}</div>
              <dl class="sm-grid">
                <dt>{{ t('help.supportAccount') }}</dt><dd>{{ auth.user?.email || '—' }}</dd>
                <dt>{{ t('help.supportPage') }}</dt><dd>{{ route.fullPath }}</dd>
              </dl>
            </div>
          </div>

          <!-- ---------- Feedback ---------- -->
          <div v-else class="help-feedback">
            <p class="help-lead">{{ t('help.feedbackLead') }}</p>

            <div class="fb-kinds" role="radiogroup" :aria-label="t('help.feedbackKind')">
              <button
                v-for="k in KINDS"
                :key="k"
                class="fb-kind"
                :class="{ 'is-active': kind === k }"
                role="radio"
                :aria-checked="kind === k"
                @click="kind = k"
              >{{ t(`help.kind.${k}`) }}</button>
            </div>

            <label class="fb-label" for="fb-message">{{ t('help.feedbackMessage') }}</label>
            <textarea
              id="fb-message"
              v-model="message"
              class="form-control"
              rows="5"
              :placeholder="t('help.feedbackPlaceholder')"
            ></textarea>

            <label class="fb-label" for="fb-email">{{ t('help.feedbackEmail') }}</label>
            <input
              id="fb-email"
              v-model="replyEmail"
              class="form-control"
              type="email"
              :placeholder="auth.user?.email || 'you@example.com'"
            />

            <div class="fb-actions">
              <button class="btn btn-soft" @click="tour.closeHelp()">{{ t('common.cancel') }}</button>
              <button class="btn btn-brand" :disabled="!canSend" @click="sendFeedback">
                <span v-if="sending" class="spinner-border spinner-border-sm"></span>
                <i v-else class="bi bi-send"></i>{{ t('help.feedbackSend') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>
