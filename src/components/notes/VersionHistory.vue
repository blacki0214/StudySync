<script setup>
/**
 * VersionHistory — a friendly, Google-Docs-style version panel. The left side is
 * a timeline of who edited and when; the right side shows that version's full
 * document (rendered), with an optional "Show changes" view that highlights what
 * was added / removed since the previous version.
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { lineDiff } from '../../utils/lineDiff.js'
import { htmlToText } from '../../utils/html.js'

const props = defineProps({ versions: { type: Array, default: () => [] } })
const emit = defineEmits(['close'])
const { t } = useI18n()

const selected = ref(0) // index into versions (newest first)
const showChanges = ref(false)

const current = computed(() => props.versions[selected.value] || null)
const previous = computed(() => props.versions[selected.value + 1] || null)
const diffRows = computed(() =>
  lineDiff(htmlToText(previous.value?.content || ''), htmlToText(current.value?.content || ''))
)
function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
</script>

<template>
  <div class="modal d-block vh-modal" tabindex="-1" @click.self="emit('close')">
    <div class="modal-dialog modal-dialog-centered modal-xl">
      <div class="modal-content vh-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="bi bi-clock-history"></i> {{ t('editor.versionHistory') }}</h5>
          <div class="vh-head-actions">
            <label class="vh-toggle"><input type="checkbox" v-model="showChanges" /> {{ t('editor.showChanges') }}</label>
            <button class="btn-close" @click="emit('close')"></button>
          </div>
        </div>

        <div class="modal-body vh-body">
          <aside class="vh-timeline">
            <button
              v-for="(v, i) in versions"
              :key="v.id"
              class="vh-item"
              :class="{ active: i === selected }"
              @click="selected = i"
            >
              <span class="vh-dot" :style="{ background: v.color }">{{ initials(v.author) }}</span>
              <span class="vh-meta">
                <span class="vh-author">{{ v.author || t('editor.someone') }}</span>
                <span class="vh-date">{{ v.date }}</span>
              </span>
            </button>
          </aside>

          <section class="vh-pane">
            <div v-if="!current" class="pr-status">{{ t('editor.noHistory') }}</div>
            <template v-else>
              <div class="vh-pane-head">
                <span class="vh-dot" :style="{ background: current.color }">{{ initials(current.author) }}</span>
                <div>
                  <div class="pr-name">{{ current.author || t('editor.someone') }}</div>
                  <div class="hist-meta">{{ current.date }} · {{ current.ago }}</div>
                </div>
              </div>

              <div v-if="!showChanges" class="vh-doc" v-html="current.content"></div>

              <div v-else class="vh-changes">
                <p class="panel-caption">{{ t('editor.changesHint') }}</p>
                <div v-for="(row, i) in diffRows" :key="i" class="vh-line" :class="'vh-' + row.type">{{ row.text || ' ' }}</div>
              </div>
            </template>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
