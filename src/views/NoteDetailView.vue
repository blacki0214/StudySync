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
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useNoteStore } from '../stores/noteStore.js'
import { useSubjectStore } from '../stores/subjectStore.js'
import { useContentStore } from '../stores/contentStore.js'
import { isSupabaseConfigured } from '../services/supabaseClient.js'
import { timeAgo } from '../utils/formatDate.js'
import { editorCollaborators, editorComments, editorHistory } from '../data/sampleEditor.js'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'
import AppSelect from '../components/common/AppSelect.vue'
import AiToolsDrawer from '../components/ai/AiToolsDrawer.vue'

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
  // Seed the contenteditable surface once (avoids v-html clobbering the cursor).
  if (docRef.value) {
    docRef.value.innerHTML =
      activeNote.value.id === 'note-1'
        ? flagshipHtml
        : activeNote.value.content
            .split(/(?<=[.!?])\s+/)
            .map((s) => `<p>${s}</p>`)
            .join('')
  }
})

onUnmounted(() => noteStore.closeNote())

// Push edits into the collaborative store (debounced save + versioning runs there).
function onDocInput() {
  if (docRef.value) noteStore.updateDraft({ content: docRef.value.innerText })
}

// Toolbar formatting via the classic contenteditable command API.
function exec(cmd, value = null) {
  document.execCommand(cmd, false, value)
  docRef.value?.focus()
}

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

const tools = [
  { cmd: 'formatBlock', val: 'h1', label: 'H1', text: true },
  { cmd: 'formatBlock', val: 'h2', label: 'H2', text: true },
  { cmd: 'bold', label: 'B', icon: 'bi-type-bold' },
  { cmd: 'italic', label: 'I', icon: 'bi-type-italic' },
  { cmd: 'underline', label: 'U', icon: 'bi-type-underline' },
  { sep: true },
  { cmd: 'insertUnorderedList', icon: 'bi-list-ul' },
  { cmd: 'insertOrderedList', icon: 'bi-list-ol' },
  { cmd: 'formatBlock', val: 'blockquote', icon: 'bi-quote' },
  { cmd: 'formatBlock', val: 'pre', icon: 'bi-code-slash' },
  { cmd: 'createLink', link: true, icon: 'bi-link-45deg' },
  { cmd: 'noop', icon: 'bi-image' }
]

function runTool(t) {
  if (t.link) {
    const url = prompt('Link URL:')
    if (url) exec('createLink', url)
  } else if (t.cmd !== 'noop') {
    exec(t.cmd, t.val || null)
  }
}
</script>

<template>
  <LoadingSpinner v-if="!ready" :label="t('common.openingEditor')" />

  <div v-else>
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
        <span class="badge-live"><span class="dot-online"></span>{{ statusLabel }}</span>
        <span class="collab-avatars">
          <img v-for="c in collaborators.filter(c=>c.avatar)" :key="c.id" :src="c.avatar" class="ca" :alt="c.name" />
          <span class="ca" style="background:#f59e0b">B</span>
        </span>
        <button class="btn-icon-sq" aria-label="Favourite"><i class="bi bi-star"></i></button>
        <button class="btn btn-outline-soft"><i class="bi bi-share"></i>{{ t('editor.share') }}</button>
        <button class="btn btn-brand" @click="aiOpen = true"><i class="bi bi-stars"></i>{{ t('editor.aiTools') }}</button>
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

    <!-- Toolbar -->
    <div class="editor-toolbar2">
      <template v-for="(t, i) in tools" :key="i">
        <div v-if="t.sep" class="tb-sep"></div>
        <button v-else class="tb-btn" :title="t.label || t.cmd" @click="runTool(t)">
          <span v-if="t.text">{{ t.label }}</span>
          <i v-else class="bi" :class="t.icon"></i>
        </button>
      </template>
      <AppSelect v-model="font" class="tb-font-select" :options="fontOptions" aria-label="Font" />
    </div>

    <!-- Document + side panel -->
    <div class="editor-grid">
      <div
        ref="docRef"
        class="doc-surface"
        contenteditable="true"
        spellcheck="false"
        @input="onDocInput"
      ></div>

      <div class="side-panel">
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
    <AiToolsDrawer v-model:open="aiOpen" :content="draft.content" :note-id="activeNote.id" />
  </div>
</template>
