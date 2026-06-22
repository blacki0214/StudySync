<script setup>
/**
 * NoteDetailView — the Collab Notes editor (matches the Figma).
 *
 * Visual: breadcrumb + title, "Live · auto-saved" status, collaborator avatars,
 * a formatting toolbar, a rich prose document, and a right panel with
 * Online / Comments / History tabs.
 *
 * Functional: the document is a contenteditable surface. Every edit flows into
 * the noteStore, which still performs the debounced auto-save, optimistic update
 * and version-conflict detection from the collaborative-editing implementation.
 * The toolbar uses execCommand to apply inline formatting.
 */
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useNoteStore } from '../stores/noteStore.js'
import { useSubjectStore } from '../stores/subjectStore.js'
import { useContentStore } from '../stores/contentStore.js'
import { isSupabaseConfigured } from '../services/supabaseClient.js'
import { timeAgo } from '../utils/formatDate.js'
import { htmlToText } from '../utils/html.js'
import { editorCollaborators, editorComments, editorHistory } from '../data/sampleEditor.js'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'
import AppSelect from '../components/common/AppSelect.vue'
import AiToolsDrawer from '../components/ai/AiToolsDrawer.vue'
import ShareDialog from '../components/notes/ShareDialog.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const noteStore = useNoteStore()
const subjectStore = useSubjectStore()
const content = useContentStore()

const { activeNote, draft, saveStatus, conflict, baseVersion, versions } = storeToRefs(noteStore)
const ready = ref(false)
const docRef = ref(null)
const activeTab = ref('online')
const aiOpen = ref(false)
const shareOpen = ref(false)

// Shared-link mode (public /share/:id route, may be anonymous).
const isShared = computed(() => route.name === 'note-share')
const canEdit = computed(() =>
  isShared.value ? activeNote.value?.share_permission === 'edit' : true
)
const font = ref('Inter')
const fontOptions = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Serif', label: 'Serif' },
  { value: 'Mono', label: 'Mono' }
]

const subject = computed(() => subjectStore.getById(activeNote.value?.subject_id))

// Rich seeded document for the flagship note (matches the mockup). Other notes
// fall back to their plain paragraphs.
const flagshipHtml = `
  <p class="doc-sub">Last edited just now by Linh · 12 min read</p>
  <h2>1. Why consensus matters</h2>
  <p>In a decentralised network, no single authority decides which transactions are valid. Consensus
  algorithms let geographically distributed nodes agree on a <mark>single shared state</mark> despite the
  presence of faulty or malicious participants (Byzantine actors).</p>
  <p>Two dominant families exist: <strong>Proof-of-Work</strong> (PoW) — first used in Bitcoin (2009) —
  and <strong>Proof-of-Stake</strong> (PoS), popularised by Ethereum's 2022 Merge. <span class="mention">Linh</span></p>
  <h2>2. Proof-of-Work</h2>
  <p>Miners race to find a nonce such that <code>SHA-256(block_header) &lt; target</code>. The first to
  succeed proposes the next block and earns a reward.</p>
  <div class="doc-callout">
    <div class="dc-label">Tuấn highlighted</div>
    <div>Energy use scales with hash rate — currently ~150 TWh/yr for Bitcoin, comparable to Argentina.</div>
  </div>
  <h2>3. Proof-of-Stake</h2>
  <ul>
    <li>Validators lock collateral ("stake") as economic security.</li>
    <li>Slashing destroys part of the stake for dishonest behaviour.</li>
    <li>Finality guarantees a committed block will never be reverted.</li>
  </ul>
`

// The collaborator presence list and inline comments are visual mocks with no
// backing table. With a real backend connected we don't fake them; in demo mode
// they stay so the editor's right panel looks populated.
const collaborators = isSupabaseConfigured ? [] : editorCollaborators
const comments = isSupabaseConfigured ? [] : editorComments

// Version history IS real (note_versions). In live mode we map the store's
// versions; in demo mode we use the seeded sample history.
const history = computed(() => {
  if (!isSupabaseConfigured) return editorHistory
  return versions.value.map((v) => ({
    id: v.id,
    version: v.version_number,
    summary: v.summary || 'Edited',
    author: content.userById(v.edited_by)?.full_name || '',
    ago: timeAgo(v.created_at)
  }))
})

onMounted(async () => {
  if (isSupabaseConfigured) content.ensureLoaded()
  if (!subjectStore.subjects.length) await subjectStore.fetchSubjects()
  try {
    await noteStore.openNote(route.params.id)
  } catch {
    router.replace('/notes')
    return
  }
  ready.value = true
  await nextTick()
  // Seed the contenteditable surface once. Content is rich HTML; legacy notes
  // (plain text) and the demo flagship note are handled gracefully.
  if (docRef.value) {
    const c = activeNote.value.content || ''
    docRef.value.innerHTML =
      activeNote.value.id === 'note-1' ? flagshipHtml
      : /<[a-z][\s\S]*>/i.test(c) ? c                       // already HTML
      : c ? c.split(/(?<=[.!?])\s+/).map((s) => `<p>${s}</p>`).join('') // legacy text
      : '<p><br></p>'                                       // empty
  }
})

onUnmounted(() => noteStore.closeNote())

// Push edits into the collaborative store. We store the rich HTML so formatting
// (headings, bold, colours, lists…) persists across reloads.
function onDocInput() {
  if (!canEdit.value) return
  if (docRef.value) noteStore.updateDraft({ content: docRef.value.innerHTML })
}
// Plain-text version of the draft for the rule-based AI tools.
const plainContent = computed(() => htmlToText(draft.value.content))

// Toolbar formatting via the classic contenteditable command API. styleWithCSS
// makes colours/sizes apply as inline styles (so they render reliably).
function exec(cmd, value = null) {
  try { document.execCommand('styleWithCSS', false, true) } catch { /* ignore */ }
  document.execCommand(cmd, false, value)
  docRef.value?.focus()
  onDocInput()
}
function runTool(tool) {
  if (tool.cmd === 'createLink') {
    const url = prompt(t('editor.linkUrl'))
    if (url) exec('createLink', url)
  } else if (tool.cmd === 'insertImage') {
    const url = prompt(t('editor.imageUrl'))
    if (url) exec('insertImage', url)
  } else {
    exec(tool.cmd, tool.val || null)
  }
}
function setColor(e) { exec('foreColor', e.target.value) }
function setHighlight(e) { exec('hiliteColor', e.target.value) }

// Font family + size selects drive the document live.
const FONT_MAP = { Inter: "Inter, sans-serif", Serif: 'Georgia, serif', Mono: 'monospace' }
const SIZE_MAP = { sm: '2', md: '3', lg: '5', xl: '6' }
const fontSize = ref('md')
watch(font, (v) => exec('fontName', FONT_MAP[v] || v))
watch(fontSize, (v) => exec('fontSize', SIZE_MAP[v] || '3'))

const fontSizeOptions = [
  { value: 'sm', label: t('editor.sizeSmall') },
  { value: 'md', label: t('editor.sizeNormal') },
  { value: 'lg', label: t('editor.sizeLarge') },
  { value: 'xl', label: t('editor.sizeHuge') }
]

const statusLabel = computed(() =>
  saveStatus.value === 'saving'
    ? t('editor.saving')
    : saveStatus.value === 'conflict'
      ? t('editor.conflict')
      : t('editor.liveAutosaved')
)

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

// Toolbar buttons, grouped (separators drawn between groups).
const toolGroups = [
  [
    { cmd: 'undo', icon: 'bi-arrow-counterclockwise', title: 'editor.undo' },
    { cmd: 'redo', icon: 'bi-arrow-clockwise', title: 'editor.redo' }
  ],
  [
    { cmd: 'formatBlock', val: 'p', label: 'P', text: true, title: 'editor.paragraph' },
    { cmd: 'formatBlock', val: 'h1', label: 'H1', text: true, title: 'editor.heading1' },
    { cmd: 'formatBlock', val: 'h2', label: 'H2', text: true, title: 'editor.heading2' },
    { cmd: 'formatBlock', val: 'h3', label: 'H3', text: true, title: 'editor.heading3' }
  ],
  [
    { cmd: 'bold', icon: 'bi-type-bold', title: 'editor.bold' },
    { cmd: 'italic', icon: 'bi-type-italic', title: 'editor.italic' },
    { cmd: 'underline', icon: 'bi-type-underline', title: 'editor.underline' },
    { cmd: 'strikeThrough', icon: 'bi-type-strikethrough', title: 'editor.strikethrough' }
  ],
  [
    { cmd: 'insertUnorderedList', icon: 'bi-list-ul', title: 'editor.bulletList' },
    { cmd: 'insertOrderedList', icon: 'bi-list-ol', title: 'editor.numberList' }
  ],
  [
    { cmd: 'formatBlock', val: 'blockquote', icon: 'bi-quote', title: 'editor.quote' },
    { cmd: 'formatBlock', val: 'pre', icon: 'bi-code-slash', title: 'editor.codeBlock' },
    { cmd: 'createLink', icon: 'bi-link-45deg', title: 'editor.link' },
    { cmd: 'insertImage', icon: 'bi-image', title: 'editor.image' },
    { cmd: 'insertHorizontalRule', icon: 'bi-dash-lg', title: 'editor.divider' }
  ],
  [
    { cmd: 'justifyLeft', icon: 'bi-text-left', title: 'editor.alignLeft' },
    { cmd: 'justifyCenter', icon: 'bi-text-center', title: 'editor.alignCenter' },
    { cmd: 'justifyRight', icon: 'bi-text-right', title: 'editor.alignRight' }
  ],
  [
    { cmd: 'removeFormat', icon: 'bi-eraser', title: 'editor.clearFormat' }
  ]
]
</script>

<template>
  <LoadingSpinner v-if="!ready" :label="t('common.openingEditor')" />

  <div v-else :class="{ 'shared-page': isShared }">
    <!-- Header -->
    <div class="editor-header">
      <div>
        <div class="eh-crumb">
          <router-link v-if="subject" :to="{ name: 'subject-hub', params: { id: subject.id } }" class="eh-crumb-link">{{ subject.code }} · {{ subject.name }}</router-link>
          <template v-else>{{ activeNote.title }}</template>
          / {{ activeNote.week || 'Notes' }}
        </div>
        <h1 class="eh-title">{{ activeNote.title }}</h1>
      </div>
      <div class="eh-actions">
        <span v-if="canEdit" class="badge-live"><span class="dot-online"></span>{{ statusLabel }}</span>
        <span v-else class="badge-soft"><i class="bi bi-eye"></i> {{ t('share.readOnly') }}</span>
        <template v-if="!isShared">
          <button class="btn-icon-sq" aria-label="Favourite"><i class="bi bi-star"></i></button>
          <button class="btn btn-outline-soft" @click="shareOpen = true"><i class="bi bi-share"></i>{{ t('editor.share') }}</button>
          <button class="btn btn-brand" @click="aiOpen = true"><i class="bi bi-stars"></i>{{ t('editor.aiTools') }}</button>
        </template>
      </div>
    </div>

    <!-- Conflict banner from the collaborative-editing logic -->
    <div v-if="conflict" class="conflict-banner">
      <div class="cb-title"><i class="bi bi-exclamation-triangle-fill"></i>{{ t('editor.conflictTitle') }}</div>
      <p class="cb-note">{{ t('editor.conflictNote', { current: conflict.currentVersion, base: baseVersion }) }}</p>
      <div class="cb-actions">
        <button class="btn btn-brand btn-sm" @click="noteStore.resolveConflictKeepMine">{{ t('editor.keepMine') }}</button>
        <button class="btn btn-outline-soft btn-sm" @click="noteStore.resolveConflictUseTheirs">{{ t('editor.useTheirs') }}</button>
      </div>
    </div>

    <!-- Toolbar (hidden when the link is view-only) -->
    <div v-if="canEdit" class="editor-toolbar2">
      <template v-for="(group, gi) in toolGroups" :key="gi">
        <div class="tb-group">
          <button
            v-for="tool in group"
            :key="tool.cmd + (tool.val || '')"
            class="tb-btn"
            :class="{ 'tb-btn-text': tool.text }"
            :title="t(tool.title)"
            @mousedown.prevent
            @click="runTool(tool)"
          >
            <span v-if="tool.text">{{ tool.label }}</span>
            <i v-else class="bi" :class="tool.icon"></i>
          </button>
        </div>
        <div class="tb-sep"></div>
      </template>

      <!-- Colours -->
      <div class="tb-group">
        <label class="tb-btn tb-color" :title="t('editor.textColor')">
          <i class="bi bi-fonts"></i>
          <input type="color" @input="setColor" />
        </label>
        <label class="tb-btn tb-color" :title="t('editor.highlight')">
          <i class="bi bi-highlighter"></i>
          <input type="color" @input="setHighlight" />
        </label>
      </div>

      <!-- Font family + size (push to the right) -->
      <div class="tb-spacer"></div>
      <AppSelect v-model="font" class="tb-font-select" :options="fontOptions" :aria-label="t('editor.font')" />
      <AppSelect v-model="fontSize" class="tb-size-select" :options="fontSizeOptions" :aria-label="t('editor.fontSize')" />
    </div>

    <!-- Document + side panel -->
    <div class="editor-grid" :class="{ 'editor-grid-solo': isShared }">
      <div
        ref="docRef"
        class="doc-surface"
        :contenteditable="canEdit"
        spellcheck="false"
        @input="onDocInput"
      ></div>

      <div v-if="!isShared" class="side-panel">
        <div class="seg-tabs">
          <button class="seg-tab" :class="{ active: activeTab==='online' }" @click="activeTab='online'">{{ t('editor.online') }}</button>
          <button class="seg-tab" :class="{ active: activeTab==='comments' }" @click="activeTab='comments'">{{ t('editor.comments') }}</button>
          <button class="seg-tab" :class="{ active: activeTab==='history' }" @click="activeTab='history'">{{ t('editor.history') }}</button>
        </div>

        <!-- Online -->
        <div v-if="activeTab==='online'">
          <div class="panel-caption">{{ t('editor.studentsInNote', { n: collaborators.length }) }}</div>
          <div v-for="c in collaborators" :key="c.id" class="presence-row">
            <span class="pr-avatar" :style="{ '--ring': c.ring }">
              <img v-if="c.avatar" :src="c.avatar" :alt="c.name" />
              <span v-else class="pr-fallback">{{ c.initials || initials(c.name) }}</span>
              <span class="pr-dot" :style="{ background: c.dot }"></span>
            </span>
            <div>
              <div class="pr-name">{{ c.name }}</div>
              <div class="pr-status">{{ c.status }}</div>
            </div>
          </div>
        </div>

        <!-- Comments -->
        <div v-else-if="activeTab==='comments'">
          <div v-for="cm in comments" :key="cm.id" class="comment-row">
            <img :src="cm.avatar" class="avatar-ring cm-avatar" :alt="cm.author" />
            <div>
              <div class="pr-name">{{ cm.author }} <span class="cm-ago">· {{ cm.ago }}</span></div>
              <div class="cm-text">{{ cm.text }}</div>
              <span v-if="cm.resolved" class="badge-soft cm-resolved">{{ t('editor.resolved') }}</span>
            </div>
          </div>
        </div>

        <!-- History -->
        <div v-else>
          <div v-for="h in history" :key="h.id" class="history-row">
            <span class="v-tag">v{{ h.version }}</span>
            <div>
              <div class="pr-name">{{ h.summary }}</div>
              <div class="hist-meta">{{ h.author }} · {{ h.ago }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Manual AI study tools for this note (runs on the live draft) -->
    <AiToolsDrawer v-model:open="aiOpen" :content="plainContent" :note-id="activeNote.id" />
    <ShareDialog v-if="shareOpen" :note="activeNote" @close="shareOpen = false" />
  </div>
</template>
