<script setup>
/**
 * NoteDetailView — the collaborative editor, now built on Tiptap (ProseMirror)
 * with a Yjs CRDT for real-time editing. Edits sync as tiny binary deltas over a
 * Supabase Realtime channel (see services/yjsProvider.js), so multiple people
 * edit live with merge-safe, low-latency updates and coloured remote cursors —
 * like Google Docs / Notion. No version-conflict logic is needed: the CRDT
 * converges automatically.
 */
import { ref, shallowRef, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import FontFamily from '@tiptap/extension-font-family'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import * as Y from 'yjs'
import { noteService } from '../services/noteService.js'
import { commentService } from '../services/commentService.js'
import { useSubjectStore } from '../stores/subjectStore.js'
import { useAuthStore } from '../stores/authStore.js'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import { SupabaseYjsProvider, u8ToBase64, base64ToU8 } from '../services/yjsProvider.js'
import { timeAgo } from '../utils/formatDate.js'
import { htmlToText } from '../utils/html.js'
import { formatDateTime } from '../utils/formatDate.js'
import { CommentMark } from '../components/notes/CommentMark.js'
import { FontSize } from '../components/notes/FontSize.js'
import AppSelect from '../components/common/AppSelect.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'
import AiToolsDrawer from '../components/ai/AiToolsDrawer.vue'
import ShareDialog from '../components/notes/ShareDialog.vue'
import VersionHistory from '../components/notes/VersionHistory.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const subjectStore = useSubjectStore()
const auth = useAuthStore()

const CURSOR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#d946ef', '#3b82f6', '#ef4444', '#14b8a6']
function colorFor(id) {
  let h = 0
  for (let i = 0; i < (id || '').length; i++) h = (h << 5) - h + id.charCodeAt(i)
  return CURSOR_COLORS[Math.abs(h) % CURSOR_COLORS.length]
}
function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

const ready = ref(false)
const note = ref(null)
const editor = shallowRef(null)
const editorTick = ref(0) // bumped on every transaction so toolbar state stays reactive
const plainContent = ref('')
const saveStatus = ref('saved')
const onlineUsers = ref([])
const activeTab = ref('online')
const aiOpen = ref(false)
const shareOpen = ref(false)

const me = computed(() => auth.user || { id: 'guest', full_name: 'Guest' })
const isShared = computed(() => route.name === 'note-share')
const canEdit = computed(() => (isShared.value ? note.value?.share_permission === 'edit' : true))
const subject = computed(() => subjectStore.getById(note.value?.subject_id))
const statusLabel = computed(() => (saveStatus.value === 'saving' ? t('editor.saving') : t('editor.liveAutosaved')))

const comments = ref([])
const history = ref([])

// Inline comment composer.
const showComposer = ref(false)
const commentDraft = ref('')
let pendingRange = null
let pendingQuote = ''

// Version history viewer.
const historyOpen = ref(false)

// Toolbar: paragraph style, font family, font size.
const fontSizePx = ref(16)
const styleOptions = computed(() => [
  { value: 'p', label: t('editor.normalText') },
  { value: 'h1', label: t('editor.heading1') },
  { value: 'h2', label: t('editor.heading2') },
  { value: 'h3', label: t('editor.heading3') }
])
const fontOptions = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times' },
  { value: 'Courier New', label: 'Mono' }
]

let ydoc = null
let provider = null
let saveTimer = null
let unsubComments = null
let unsubVersions = null
let lastSnapshotAt = 0

function updateOnline() {
  if (!provider) { onlineUsers.value = [{ name: me.value.full_name, color: colorFor(me.value.id) }]; return }
  const states = provider.awareness.getStates()
  onlineUsers.value = Array.from(states.values()).map((s) => s.user).filter(Boolean)
}

function scheduleSave() {
  saveStatus.value = 'saving'
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    try {
      await noteService.saveNote({
        id: note.value.id,
        content: editor.value.getHTML(),
        ydoc: isSupabaseConfigured && ydoc ? u8ToBase64(Y.encodeStateAsUpdate(ydoc)) : null
      })
      saveStatus.value = 'saved'
    } catch {
      saveStatus.value = 'idle'
    }
  }, 1000)
}

onMounted(async () => {
  if (!subjectStore.subjects.length) await subjectStore.fetchSubjects()
  note.value = await noteService.getNote(route.params.id)
  if (!note.value) { router.replace('/notes'); return }

  // Build the shared CRDT document and (live) the realtime provider.
  ydoc = new Y.Doc()
  if (isSupabaseConfigured && note.value.ydoc) {
    try { Y.applyUpdate(ydoc, base64ToU8(note.value.ydoc)) } catch { /* ignore */ }
  }
  if (isSupabaseConfigured) {
    provider = new SupabaseYjsProvider(note.value.id, ydoc, { user: me.value })
    provider.awareness.on('change', updateOnline)
  }
  updateOnline()

  const extensions = [
    StarterKit.configure({ history: false }), // history comes from Collaboration (Yjs)
    Underline,
    Link.configure({ openOnClick: false }),
    Image,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Highlight.configure({ multicolor: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    CommentMark,
    Placeholder.configure({ placeholder: t('editor.placeholder') }),
    Collaboration.configure({ document: ydoc })
  ]
  if (provider) {
    extensions.push(CollaborationCursor.configure({
      provider,
      user: { name: me.value.full_name, color: colorFor(me.value.id) }
    }))
  }

  editor.value = new Editor({
    editable: canEdit.value,
    extensions,
    // Turn off the browser's red spellcheck squiggles inside the document.
    editorProps: { attributes: { spellcheck: 'false' } },
    onUpdate: ({ editor }) => { plainContent.value = editor.getText() },
    onTransaction: () => { editorTick.value++ }
  })

  // Seed legacy notes (HTML content but no CRDT state yet) exactly once.
  if (editor.value.isEmpty && note.value.content) {
    editor.value.commands.setContent(note.value.content, false)
  }
  plainContent.value = editor.value.getText()

  // Save + snapshot ONLY on local edits (origin !== our provider), so version
  // history is attributed to the person who actually typed.
  ydoc.on('update', (_u, origin) => {
    if (origin !== provider && canEdit.value) onLocalEdit()
  })

  await loadComments()
  unsubComments = commentService.subscribe(note.value.id, loadComments)

  await refreshHistory()
  // Keep the timeline live as collaborators snapshot their edits.
  unsubVersions = noteService.subscribeVersions(note.value.id, refreshHistory)

  ready.value = true
})

onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  unsubComments?.()
  unsubVersions?.()
  editor.value?.destroy()
  provider?.destroy()
  ydoc?.destroy()
})

// --- History (authored, throttled snapshots) -------------------------------
function normalizeVersion(row) {
  return {
    id: row.id,
    version: row.version_number,
    author: row.author?.full_name || row.author_name || '',
    color: colorFor(row.edited_by || row.author?.full_name || row.author_name || ''),
    ago: timeAgo(row.created_at),
    date: formatDateTime(row.created_at),
    content: row.content // HTML snapshot
  }
}
// Pull the latest version list from the server and map it for the timeline.
// Used on load, on the realtime version event, and when the user opens History.
async function refreshHistory() {
  try {
    const versions = await noteService.listVersions(note.value.id)
    history.value = versions.map(normalizeVersion)
  } catch { /* keep the current list */ }
}
// Open the full history modal, refreshing first so it's never stale.
function openHistory() {
  historyOpen.value = true
  refreshHistory()
}
function maybeSnapshot() {
  const now = Date.now()
  if (now - lastSnapshotAt < 25000) return // at most one snapshot / 25s of typing
  lastSnapshotAt = now
  noteService
    .addVersion({ noteId: note.value.id, content: editor.value.getHTML(), editedBy: me.value.id, authorName: me.value.full_name })
    .then((row) => { if (row) history.value.unshift(normalizeVersion(row)) })
    .catch(() => {})
}
function onLocalEdit() {
  scheduleSave()
  maybeSnapshot()
}

// Toolbar: paragraph style / font family / font size.
const currentStyle = computed(() => {
  editorTick.value
  const e = editor.value
  if (!e) return 'p'
  if (e.isActive('heading', { level: 1 })) return 'h1'
  if (e.isActive('heading', { level: 2 })) return 'h2'
  if (e.isActive('heading', { level: 3 })) return 'h3'
  return 'p'
})
function applyStyle(v) {
  if (v === 'p') chain().setParagraph().run()
  else chain().toggleHeading({ level: Number(v.slice(1)) }).run()
}
const currentFont = computed(() => { editorTick.value; return editor.value?.getAttributes('textStyle').fontFamily || 'Inter' })
function setFont(v) { chain().setFontFamily(v).run() }
function changeFontSize(delta) {
  fontSizePx.value = Math.min(72, Math.max(8, fontSizePx.value + delta))
  chain().setFontSize(fontSizePx.value + 'px').run()
}

// --- Inline comments -------------------------------------------------------
async function loadComments() {
  comments.value = await commentService.list(note.value.id)
}
function startComment() {
  const { from, to } = editor.value.state.selection
  if (from === to) return // need a selection
  pendingRange = { from, to }
  pendingQuote = editor.value.state.doc.textBetween(from, to, ' ').slice(0, 200)
  commentDraft.value = ''
  showComposer.value = true
}
async function submitComment() {
  if (!commentDraft.value.trim() || !pendingRange) return
  const commentId = 'c-' + Math.random().toString(36).slice(2, 10)
  editor.value.chain().focus().setTextSelection(pendingRange).setComment(commentId).run()
  const row = await commentService.add({
    noteId: note.value.id, commentId, authorId: me.value.id, authorName: me.value.full_name,
    quote: pendingQuote, body: commentDraft.value.trim()
  })
  comments.value.push(row)
  showComposer.value = false
  pendingRange = null
  activeTab.value = 'comments'
}
async function removeComment(c) {
  await commentService.remove(c.id)
  comments.value = comments.value.filter((x) => x.id !== c.id)
  editor.value?.commands.unsetCommentById(c.comment_id)
}
function locateComment(c) {
  // Select the marked range so the user can see which text it refers to.
  const type = editor.value.state.schema.marks.comment
  let found = null
  editor.value.state.doc.descendants((node, pos) => {
    if (found || !node.isText) return
    if (node.marks.some((m) => m.type === type && m.attrs.commentId === c.comment_id)) {
      found = { from: pos, to: pos + node.nodeSize }
    }
  })
  if (found) editor.value.chain().focus().setTextSelection(found).run()
}
const hasSelection = computed(() => {
  editorTick.value
  const s = editor.value?.state.selection
  return !!s && s.from !== s.to
})

// Inline title rename: the heading is contenteditable; save on blur/Enter.
async function renameTitle(e) {
  const name = (e.target.textContent || '').replace(/\s+/g, ' ').trim()
  if (!name || name === note.value.title) {
    e.target.textContent = note.value.title // restore if blank/unchanged
    return
  }
  note.value.title = name
  e.target.textContent = name
  try { await noteService.renameNote(note.value.id, name) } catch { /* keep optimistic value */ }
}

// Toolbar command helpers.
function chain() { return editor.value.chain().focus() }
function setLink() {
  const url = prompt(t('editor.linkUrl'))
  if (url === null) return
  if (url === '') chain().unsetLink().run()
  else chain().extendMarkRange('link').setLink({ href: url }).run()
}
// Image insert is an upload, not a URL prompt: the user picks a file from their
// device. Live mode uploads to the public `note-images` Storage bucket; demo
// mode (and any upload failure) falls back to inlining the image as a data URL,
// so it always works offline too.
const imageInput = ref(null)
const uploadingImage = ref(false)
function setImage() {
  imageInput.value?.click()
}
async function onImagePicked(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // let the same file be picked again later
  if (!file) return
  if (!file.type.startsWith('image/')) return
  if (file.size > 5 * 1024 * 1024) {
    alert(t('editor.imageTooLarge'))
    return
  }
  uploadingImage.value = true
  try {
    const src = await uploadImage(file)
    if (src) chain().setImage({ src }).run()
  } catch {
    alert(t('editor.imageFailed'))
  } finally {
    uploadingImage.value = false
  }
}
async function uploadImage(file) {
  if (isSupabaseConfigured && supabase) {
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${auth.user?.id || 'anon'}/${Date.now()}-${safe}`
      const { error } = await supabase.storage.from('note-images').upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from('note-images').getPublicUrl(path)
        if (data?.publicUrl) return data.publicUrl
      }
      // Bucket missing or upload denied → fall back to an inline data URL.
    } catch { /* fall through */ }
  }
  return await fileToDataUrl(file)
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
function isActive(name, attrs) { editorTick.value; return editor.value?.isActive(name, attrs) }
</script>

<template>
  <LoadingSpinner v-if="!ready" :label="t('common.openingEditor')" />

  <div v-else-if="note">
    <!-- Header -->
    <div class="editor-header">
      <div>
        <div class="eh-crumb">
          <router-link v-if="subject" :to="{ name: 'subject-hub', params: { id: subject.id } }" class="eh-crumb-link">{{ subject.code }} · {{ subject.name }}</router-link>
          <template v-else>{{ note.title }}</template>
          / {{ note.week || 'Notes' }}
        </div>
        <!-- v-once: render the title once, then we manage its text manually so
             frequent re-renders (presence/typing) can't clobber in-progress edits. -->
        <h1
          v-if="canEdit"
          v-once
          class="eh-title eh-title-edit"
          contenteditable="true"
          spellcheck="false"
          :title="t('editor.renameHint')"
          @keydown.enter.prevent="$event.target.blur()"
          @blur="renameTitle"
        >{{ note.title }}</h1>
        <h1 v-else class="eh-title">{{ note.title }}</h1>
      </div>
      <div class="eh-actions">
        <span v-if="canEdit" class="badge-live"><span class="dot-online"></span>{{ statusLabel }}</span>
        <span v-else class="badge-soft"><i class="bi bi-eye"></i> {{ t('share.readOnly') }}</span>
        <template v-if="!isShared">
          <button class="btn btn-outline-soft" @click="shareOpen = true"><i class="bi bi-share"></i>{{ t('editor.share') }}</button>
          <button class="btn btn-brand" @click="aiOpen = true"><i class="bi bi-stars"></i>{{ t('editor.aiTools') }}</button>
        </template>
      </div>
    </div>

    <!-- Toolbar (hidden when view-only) -->
    <div v-if="canEdit && editor" class="editor-toolbar2">
      <div class="tb-group">
        <button class="tb-btn" :title="t('editor.undo')" @click="chain().undo().run()"><i class="bi bi-arrow-counterclockwise"></i></button>
        <button class="tb-btn" :title="t('editor.redo')" @click="chain().redo().run()"><i class="bi bi-arrow-clockwise"></i></button>
      </div>
      <div class="tb-sep"></div>
      <!-- Paragraph style + font + size -->
      <AppSelect class="tb-style" :model-value="currentStyle" :options="styleOptions" :aria-label="t('editor.style')" @update:model-value="applyStyle" />
      <AppSelect class="tb-font2" :model-value="currentFont" :options="fontOptions" :aria-label="t('editor.font')" @update:model-value="setFont" />
      <div class="tb-group tb-size">
        <button class="tb-btn" :title="t('editor.smaller')" @click="changeFontSize(-1)"><i class="bi bi-dash"></i></button>
        <span class="tb-size-val">{{ fontSizePx }}</span>
        <button class="tb-btn" :title="t('editor.larger')" @click="changeFontSize(1)"><i class="bi bi-plus"></i></button>
      </div>
      <div class="tb-sep"></div>
      <div class="tb-group">
        <button class="tb-btn" :class="{ on: isActive('bold') }" :title="t('editor.bold')" @click="chain().toggleBold().run()"><i class="bi bi-type-bold"></i></button>
        <button class="tb-btn" :class="{ on: isActive('italic') }" :title="t('editor.italic')" @click="chain().toggleItalic().run()"><i class="bi bi-type-italic"></i></button>
        <button class="tb-btn" :class="{ on: isActive('underline') }" :title="t('editor.underline')" @click="chain().toggleUnderline().run()"><i class="bi bi-type-underline"></i></button>
        <button class="tb-btn" :class="{ on: isActive('strike') }" :title="t('editor.strikethrough')" @click="chain().toggleStrike().run()"><i class="bi bi-type-strikethrough"></i></button>
        <label class="tb-btn tb-color" :title="t('editor.textColor')"><i class="bi bi-fonts"></i><input type="color" @input="chain().setColor($event.target.value).run()" /></label>
        <label class="tb-btn tb-color" :title="t('editor.highlight')"><i class="bi bi-highlighter"></i><input type="color" @input="chain().toggleHighlight({ color: $event.target.value }).run()" /></label>
      </div>
      <div class="tb-sep"></div>
      <div class="tb-group">
        <button class="tb-btn" :class="{ on: isActive('link') }" :title="t('editor.link')" @click="setLink"><i class="bi bi-link-45deg"></i></button>
        <button class="tb-btn" :class="{ disabled: !hasSelection }" :disabled="!hasSelection" :title="t('editor.comment')" @click="startComment"><i class="bi bi-chat-left-text"></i></button>
        <button class="tb-btn" :class="{ disabled: uploadingImage }" :disabled="uploadingImage" :title="t('editor.image')" @click="setImage">
          <i class="bi" :class="uploadingImage ? 'bi-arrow-repeat spin' : 'bi-image'"></i>
        </button>
        <input ref="imageInput" type="file" accept="image/*" class="d-none" @change="onImagePicked" />
      </div>
      <div class="tb-sep"></div>
      <div class="tb-group">
        <button class="tb-btn" :class="{ on: isActive({ textAlign: 'left' }) }" :title="t('editor.alignLeft')" @click="chain().setTextAlign('left').run()"><i class="bi bi-text-left"></i></button>
        <button class="tb-btn" :class="{ on: isActive({ textAlign: 'center' }) }" :title="t('editor.alignCenter')" @click="chain().setTextAlign('center').run()"><i class="bi bi-text-center"></i></button>
        <button class="tb-btn" :class="{ on: isActive({ textAlign: 'right' }) }" :title="t('editor.alignRight')" @click="chain().setTextAlign('right').run()"><i class="bi bi-text-right"></i></button>
      </div>
      <div class="tb-sep"></div>
      <div class="tb-group">
        <button class="tb-btn" :class="{ on: isActive('taskList') }" :title="t('editor.checklist')" @click="chain().toggleTaskList().run()"><i class="bi bi-check2-square"></i></button>
        <button class="tb-btn" :class="{ on: isActive('bulletList') }" :title="t('editor.bulletList')" @click="chain().toggleBulletList().run()"><i class="bi bi-list-ul"></i></button>
        <button class="tb-btn" :class="{ on: isActive('orderedList') }" :title="t('editor.numberList')" @click="chain().toggleOrderedList().run()"><i class="bi bi-list-ol"></i></button>
        <button class="tb-btn" :class="{ on: isActive('blockquote') }" :title="t('editor.quote')" @click="chain().toggleBlockquote().run()"><i class="bi bi-quote"></i></button>
        <button class="tb-btn" :class="{ on: isActive('codeBlock') }" :title="t('editor.codeBlock')" @click="chain().toggleCodeBlock().run()"><i class="bi bi-code-slash"></i></button>
        <button class="tb-btn" :title="t('editor.divider')" @click="chain().setHorizontalRule().run()"><i class="bi bi-dash-lg"></i></button>
        <button class="tb-btn" :title="t('editor.clearFormat')" @click="chain().unsetAllMarks().clearNodes().run()"><i class="bi bi-eraser"></i></button>
      </div>
    </div>

    <!-- Document + side panel -->
    <div class="editor-grid">
      <EditorContent :editor="editor" class="doc-surface" />

      <div class="side-panel">
        <div class="seg-tabs">
          <button class="seg-tab" :class="{ active: activeTab==='online' }" @click="activeTab='online'">{{ t('editor.online') }}</button>
          <button class="seg-tab" :class="{ active: activeTab==='comments' }" @click="activeTab='comments'">{{ t('editor.comments') }}</button>
          <button class="seg-tab" :class="{ active: activeTab==='history' }" @click="activeTab='history'; refreshHistory()">{{ t('editor.history') }}</button>
        </div>

        <!-- Online (real presence via Yjs awareness) -->
        <div v-if="activeTab==='online'">
          <div class="panel-caption">{{ t('editor.studentsInNote', { n: onlineUsers.length }) }}</div>
          <div v-for="(u, i) in onlineUsers" :key="i" class="presence-row">
            <span class="pr-avatar"><span class="pr-fallback" :style="{ background: u.color }">{{ initials(u.name) }}</span><span class="pr-dot" style="background: var(--c-live)"></span></span>
            <div><div class="pr-name">{{ u.name }}</div><div class="pr-status">{{ t('editor.editing') }}</div></div>
          </div>
        </div>

        <!-- Comments (inline, anchored to the text) -->
        <div v-else-if="activeTab==='comments'">
          <p class="panel-caption">{{ t('editor.commentsHint') }}</p>
          <p v-if="!comments.length" class="pr-status">{{ t('editor.noComments') }}</p>
          <div v-for="cm in comments" :key="cm.id" class="comment-card">
            <div class="comment-head">
              <span class="user-avatar cm-av">{{ initials(cm.author_name) }}</span>
              <span class="pr-name">{{ cm.author_name || t('editor.someone') }}</span>
              <span class="cm-ago">· {{ timeAgo(cm.created_at) }}</span>
              <button class="cm-del" :title="t('editor.deleteComment')" @click="removeComment(cm)"><i class="bi bi-x-lg"></i></button>
            </div>
            <div v-if="cm.quote" class="cm-quote" @click="locateComment(cm)">“{{ cm.quote }}”</div>
            <div class="cm-text">{{ cm.body }}</div>
          </div>
        </div>

        <!-- History (friendly timeline; click to open full version history) -->
        <div v-else>
          <p v-if="!history.length" class="pr-status">{{ t('editor.noHistory') }}</p>
          <template v-else>
            <button class="btn btn-outline-soft w-100 history-open-btn" @click="openHistory">
              <i class="bi bi-clock-history"></i>{{ t('editor.openHistory') }}
            </button>
            <button v-for="h in history.slice(0, 6)" :key="h.id" class="history-row history-btn" @click="openHistory">
              <span class="hist-dot" :style="{ background: h.color }">{{ initials(h.author) }}</span>
              <div>
                <div class="pr-name">{{ h.author || t('editor.someone') }}</div>
                <div class="hist-meta">{{ h.ago }}</div>
              </div>
            </button>
          </template>
        </div>
      </div>
    </div>

    <AiToolsDrawer v-model:open="aiOpen" :content="plainContent" :note-id="note.id" />
    <ShareDialog v-if="shareOpen" :note="note" @close="shareOpen = false" />

    <!-- Add-comment composer -->
    <div v-if="showComposer" class="modal d-block" tabindex="-1" style="background: rgba(15,23,42,.5)" @click.self="showComposer = false">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title"><i class="bi bi-chat-left-text"></i> {{ t('editor.addComment') }}</h5><button class="btn-close" @click="showComposer = false"></button></div>
          <div class="modal-body">
            <div v-if="pendingQuote" class="cm-quote">“{{ pendingQuote }}”</div>
            <textarea v-model="commentDraft" class="form-control" rows="4" :placeholder="t('editor.commentPlaceholder')" @keydown.ctrl.enter="submitComment"></textarea>
          </div>
          <div class="modal-footer">
            <button class="btn btn-soft" @click="showComposer = false">{{ t('common.cancel') }}</button>
            <button class="btn btn-brand" :disabled="!commentDraft.trim()" @click="submitComment">{{ t('editor.postComment') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Friendly version history -->
    <VersionHistory v-if="historyOpen" :versions="history" @close="historyOpen = false" />
  </div>
</template>
