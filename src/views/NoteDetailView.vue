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
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { ResizableImage } from '../components/notes/ResizableImage.js'
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
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { DataGrid } from '../components/notes/DataGrid.js'
import { FileAttachment } from '../components/notes/FileAttachment.js'
import { createLowlight, common } from 'lowlight'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import CodeBlockView from '../components/notes/CodeBlockView.vue'
import * as Y from 'yjs'
import { noteService } from '../services/noteService.js'
import { commentService } from '../services/commentService.js'
import { useSubjectStore } from '../stores/subjectStore.js'
import { useContentStore } from '../stores/contentStore.js'
import { useAuthStore } from '../stores/authStore.js'
import { useDialogStore } from '../stores/dialogStore.js'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import { SupabaseYjsProvider, u8ToBase64, base64ToU8 } from '../services/yjsProvider.js'
import { isAiConfigured, rewrite as aiRewrite, generateTitle as aiGenerateTitle } from '../services/aiService.js'
import { timeAgo } from '../utils/formatDate.js'
import { htmlToText } from '../utils/html.js'
import { formatDateTime } from '../utils/formatDate.js'
import { exportNotePdf, exportNoteDocx } from '../utils/exporters.js'
import { readDataFile, rowsToTableHtml } from '../utils/dataImport.js'
import { CommentMark } from '../components/notes/CommentMark.js'
import { FontSize } from '../components/notes/FontSize.js'
import AppSelect from '../components/common/AppSelect.vue'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'
import AiToolsDrawer from '../components/ai/AiToolsDrawer.vue'
import ShareDialog from '../components/notes/ShareDialog.vue'
import VersionHistory from '../components/notes/VersionHistory.vue'
import { useFocusTracker } from '../composables/useFocusTracker.js'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const subjectStore = useSubjectStore()
const contentStore = useContentStore()

const auth = useAuthStore()
const dialog = useDialogStore()

// Opened through a shareable link? Those are public — a signed-out visitor can
// land here, so everything below has to work without an account.
const isShared = route.name === 'note-share'
const isAnon = computed(() => !auth.isAuthenticated)

// Count time on this page toward the Hub's weekly focus chart. Shared-link
// visitors aren't studying their own material, so they don't get tracked.
if (!isShared) useFocusTracker('notes')

// Keyboard-shortcut hints shown in toolbar tooltips (Notion/Docs style).
// Mac shows ⌘/⌥ instead of Ctrl/Alt; the actual key bindings use TipTap's
// "Mod" which already maps to ⌘ on macOS and Ctrl elsewhere.
const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform)
function kbd(keys) {
  return isMac ? keys.replace(/Ctrl/g, '⌘').replace(/Alt/g, '⌥').replace(/Shift/g, '⇧').replace(/\+/g, '') : keys
}
// Tooltip = translated label + " · " + the shortcut for that action.
function tip(key, keys) {
  return t(key) + ' · ' + kbd(keys)
}

// Syntax highlighting for code blocks (IDE-style colours via highlight.js).
const lowlight = createLowlight(common)

const CURSOR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#d946ef', '#3b82f6', '#ef4444', '#14b8a6']
function colorFor(id) {
  let h = 0
  for (let i = 0; i < (id || '').length; i++) h = (h << 5) - h + id.charCodeAt(i)
  return CURSOR_COLORS[Math.abs(h) % CURSOR_COLORS.length]
}
function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

// Signed-out visitors on a shared link still need an identity so presence and
// remote cursors work. It is generated once per browser and kept in
// localStorage, so a guest keeps the same name/colour across reloads instead of
// every anonymous tab colliding on a single "guest" id.
const GUEST_KEY = 'studysync.guest'
function loadGuest() {
  try {
    const saved = JSON.parse(localStorage.getItem(GUEST_KEY) || 'null')
    if (saved?.id) return saved
  } catch { /* corrupt entry → mint a new one */ }
  const g = {
    id: 'guest-' + Math.random().toString(36).slice(2, 10),
    full_name: 'Guest ' + Math.floor(1000 + Math.random() * 9000)
  }
  try { localStorage.setItem(GUEST_KEY, JSON.stringify(g)) } catch { /* private mode */ }
  return g
}
const guest = loadGuest()

const ready = ref(false)
const note = ref(null)
const editor = shallowRef(null)
const editorTick = ref(0) // bumped on every transaction so toolbar state stays reactive
const plainContent = ref('')
const saveStatus = ref('saved')
const onlineUsers = ref([])
const activeTab = ref('online')
const aiOpen = ref(false)
const aiMenuOpen = ref(false) // editor "✨ Ask AI" rewrite menu
const aiBusy = ref(false)
const titleEl = ref(null) // the contenteditable <h1>, managed manually (v-once)
const titleBusy = ref(false)
const shareOpen = ref(false)
const linkUnavailable = ref(false) // shared link is off, or the note is gone
const exportOpen = ref(false)
const exportBusy = ref('') // '' | 'pdf' | 'docx' — drives the per-item spinner

const me = computed(() => auth.user || guest)
// A shared link only grants editing while it is switched on AND set to "edit";
// the owner turning sharing off downgrades open guests to read-only on reload.
const canEdit = computed(() =>
  isShared ? note.value?.share_enabled === true && note.value?.share_permission === 'edit' : true
)
// Commenting and version snapshots are writes that RLS limits to accounts, so
// they stay hidden from signed-out guests.
const canComment = computed(() => !isAnon.value)
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
  // Guests have no subjects of their own — skip the fetch and let the
  // breadcrumb fall back to the note title.
  if (!isAnon.value && !subjectStore.subjects.length) await subjectStore.fetchSubjects()

  try {
    note.value = await noteService.getNote(route.params.id)
  } catch {
    note.value = null
  }
  // A missing note, or a link the owner has switched off, shows the "link
  // unavailable" screen. Guests must never be redirected to /notes — that is a
  // private route and would bounce them to the login page.
  if (!note.value || (isShared && !note.value.share_enabled)) {
    if (isShared) { linkUnavailable.value = true; ready.value = true; return }
    router.replace('/notes')
    return
  }

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

  // Shortcuts for actions that have NO TipTap default. The formatting/structure
  // shortcuts (Ctrl+B/I/U, Ctrl+Shift+S, headings Ctrl+Alt+1-3, lists
  // Ctrl+Shift+7/8/9, quote Ctrl+Shift+B, code block Ctrl+Alt+C, undo/redo)
  // already ship with StarterKit & the mark extensions. These closures call the
  // component helpers; returning true tells ProseMirror we handled the key so
  // the browser's own shortcut (e.g. Ctrl+K) doesn't fire.
  const Shortcuts = Extension.create({
    name: 'studysyncShortcuts',
    addKeyboardShortcuts() {
      return {
        'Mod-k': () => { if (canEdit.value) setLink(); return true },          // attach file
        'Mod-Alt-i': () => { if (canEdit.value) setImage(); return true },     // insert image
        'Mod-Alt-t': () => { if (canEdit.value) insertTable(); return true },  // insert table
        'Mod-Alt-m': () => { startComment(); return true },                    // comment on selection
        'Mod-\\': () => this.editor.chain().focus().unsetAllMarks().clearNodes().run() // clear formatting
      }
    }
  })

  const extensions = [
    Shortcuts,
    StarterKit.configure({ history: false, codeBlock: false }), // history → Collaboration; codeBlock → lowlight
    CodeBlockLowlight.extend({
      draggable: true, // allow moving the block via its title-bar drag handle
      addNodeView() { return VueNodeViewRenderer(CodeBlockView) }
    }).configure({ lowlight }),
    Underline,
    Link.configure({ openOnClick: false }),
    ResizableImage,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Highlight.configure({ multicolor: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    // Data tables — resizable columns; pasting from Excel/Sheets/CSV lands as a
    // real table because the clipboard carries <table> HTML.
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    DataGrid, // paged viewer for large imported datasets
    FileAttachment, // compact chip for attached files
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

  // Comments and version history are account-only features; guests just read or
  // edit the document itself.
  if (canComment.value) {
    await loadComments()
    unsubComments = commentService.subscribe(note.value.id, loadComments)

    await refreshHistory()
    // Keep the timeline live as collaborators snapshot their edits.
    unsubVersions = noteService.subscribeVersions(note.value.id, refreshHistory)
  }

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
  // note_versions.edited_by is a real profile reference — a guest has none, so
  // their edits save to the note without adding a history entry.
  if (!canComment.value) return
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
  if (!canComment.value) return // commenting requires an account
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
  contentStore.setNoteTitle(note.value.id, name) // keep other views in sync
  try { await noteService.renameNote(note.value.id, name) } catch { /* keep optimistic value */ }
}

// Generate a title from the note body (Gemini, with a heuristic fallback).
async function generateTitleFromNote() {
  if (!editor.value || titleBusy.value) return
  const text = editor.value.getText().trim()
  if (text.length < 20) { dialog.toast(t('editor.titleNeedsContent'), 'warning'); return }
  titleBusy.value = true
  try {
    const title = await aiGenerateTitle(text)
    if (!title) { dialog.toast(t('editor.titleFailed'), 'error'); return }
    note.value.title = title
    if (titleEl.value) titleEl.value.textContent = title // heading is v-once → set manually
    contentStore.setNoteTitle(note.value.id, title) // keep other views in sync
    try { await noteService.renameNote(note.value.id, title) } catch { /* keep optimistic value */ }
  } catch {
    dialog.toast(t('editor.titleFailed'), 'error')
  } finally {
    titleBusy.value = false
  }
}

// Clicking the empty area of the page (below the content, or next to a floated
// image / after a trailing image) should place the caret there to type — adding
// a paragraph at the end if the document doesn't end in editable text.
function onSurfaceClick(e) {
  if (!editor.value || !canEdit.value) return
  const cl = e.target?.classList
  if (!cl || !(cl.contains('doc-surface') || cl.contains('ProseMirror'))) return // clicked real content
  const { state } = editor.value
  const end = state.doc.content.size
  if (state.doc.lastChild?.isTextblock) {
    editor.value.chain().focus().setTextSelection(end).run()
  } else {
    editor.value.chain().focus().insertContentAt(end, { type: 'paragraph' }).setTextSelection(end + 1).run()
  }
}

// Toolbar command helpers.
function chain() { return editor.value.chain().focus() }

// "Link" is a LOCAL FILE attachment, not a URL prompt: the user picks a file
// from their device, we upload it and insert a link to it (labelled with the
// file name). Selected text, if any, becomes the link label instead.
const linkInput = ref(null)
const uploadingLink = ref(false)
function setLink() {
  linkInput.value?.click()
}
async function onLinkFilePicked(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (file.size > 15 * 1024 * 1024) { dialog.toast(t('editor.linkFileTooLarge'), 'warning'); return }
  uploadingLink.value = true
  try {
    const href = await uploadFile(file, 'note-files')
    if (!href) { dialog.toast(t('editor.linkFailed'), 'error'); return }
    // Insert a compact file-chip node (icon/thumb + name + size), not a raw link —
    // the (possibly huge data-URL) href stays in an attribute, never visible text.
    chain().insertContent({
      type: 'fileAttachment',
      attrs: { href, name: file.name, mime: file.type, size: file.size }
    }).run()
    dialog.toast(t('editor.linkAdded'), 'success')
  } catch {
    dialog.toast(t('editor.linkFailed'), 'error')
  } finally {
    uploadingLink.value = false
  }
}

// Image insert is an upload: the user picks a file from their device. Live mode
// uploads to the public `note-images` Storage bucket; demo mode (and any upload
// failure) falls back to inlining the image as a data URL, so it works offline.
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
    dialog.toast(t('editor.imageTooLarge'), 'warning')
    return
  }
  uploadingImage.value = true
  try {
    const src = await uploadFile(file, 'note-images')
    if (src) chain().setImage({ src }).run()
  } catch {
    dialog.toast(t('editor.imageFailed'), 'error')
  } finally {
    uploadingImage.value = false
  }
}
// Upload a file to a public Storage bucket, returning its public URL. Falls back
// to an inline data URL when Storage is unavailable (demo mode / upload denied).
async function uploadFile(file, bucket) {
  if (isSupabaseConfigured && supabase) {
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${auth.user?.id || 'anon'}/${Date.now()}-${safe}`
      const { error } = await supabase.storage.from(bucket).upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path)
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

// --- AI rewrite (Gemini) ---------------------------------------------------
// Transform the current selection (or, for "continue", extend from the caret).
// The result replaces the selection so it reads like an inline edit assistant.
async function runRewrite(mode) {
  aiMenuOpen.value = false
  if (!editor.value || !canEdit.value || aiBusy.value) return
  const { from, to, empty } = editor.value.state.selection
  let text = empty ? '' : editor.value.state.doc.textBetween(from, to, ' ')
  // "continue" needs no selection — feed it the tail of the document as context.
  if (mode === 'continue' && !text) text = editor.value.getText().slice(-1500)
  if (!text.trim()) { dialog.toast(t('editor.aiNeedsSelection'), 'warning'); return }

  aiBusy.value = true
  try {
    const out = await aiRewrite(text, mode)
    if (!out) { dialog.toast(t('editor.aiFailed'), 'error'); return }
    if (mode === 'continue') {
      editor.value.chain().focus().insertContent(' ' + out).run()
    } else {
      editor.value.chain().focus().insertContentAt({ from, to }, out).run()
    }
  } catch {
    dialog.toast(t('editor.aiFailed'), 'error')
  } finally {
    aiBusy.value = false
  }
}

// --- Data tables -----------------------------------------------------------
const tableMenuOpen = ref(false)
const inTable = computed(() => { editorTick.value; return !!editor.value?.isActive('table') })
function insertTable() {
  chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}
// Run a table command, then close the contextual menu.
function tableCmd(fn) {
  fn(chain())?.run?.()
  if (!editor.value?.isActive('table')) tableMenuOpen.value = false
}

// Import data (CSV / TSV / Excel) → an editable table inserted at the caret.
const dataInput = ref(null)
const importingData = ref(false)
function importData() {
  if (importingData.value) return
  dataInput.value?.click()
}
async function onDataFilePicked(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // allow re-importing the same file later
  if (!file || !editor.value) return
  if (file.size > 8 * 1024 * 1024) { dialog.toast(t('editor.dataFileTooLarge'), 'warning'); return }
  importingData.value = true
  try {
    const { rows, truncated } = await readDataFile(file)
    // Large datasets → a paged data-grid (first 10 rows + pager) so the document
    // stays light. Small ones → a normal editable table the user can tweak.
    if (rows.length - 1 > 10) {
      editor.value.chain().focus().insertContent({
        type: 'dataGrid',
        attrs: { rows, headerRow: true, pageSize: 10, caption: file.name }
      }).run()
    } else {
      const html = rowsToTableHtml(rows, { headerRow: true })
      editor.value.chain().focus().insertContent(html).run()
    }
    if (truncated) dialog.toast(t('editor.dataTruncated'), 'info')
  } catch (err) {
    console.error('Data import failed', err)
    dialog.toast(err?.message === 'unsupported-type' ? t('editor.dataUnsupported') : t('editor.dataImportFailed'), 'error')
  } finally {
    importingData.value = false
  }
}

// --- Export (PDF / Word) ---------------------------------------------------
// Subtitle line shown under the title in the exported file: subject + week.
const exportSubtitle = computed(() => {
  const parts = []
  if (subject.value) parts.push(`${subject.value.code} · ${subject.value.name}`)
  if (note.value?.week) parts.push(note.value.week)
  return parts.join('  ·  ')
})
async function runExport(kind) {
  if (exportBusy.value || !editor.value) return
  exportBusy.value = kind
  const payload = { title: note.value?.title || 'Note', subtitle: exportSubtitle.value, html: editor.value.getHTML() }
  try {
    if (kind === 'pdf') await exportNotePdf(payload)
    else await exportNoteDocx(payload)
    exportOpen.value = false
  } catch (err) {
    console.error('Export failed', err)
    dialog.toast(t('editor.exportFailed'), 'error')
  } finally {
    exportBusy.value = ''
  }
}
</script>

<template>
  <LoadingSpinner v-if="!ready" :label="t('common.openingEditor')" />

  <!-- Shared link that is switched off (or points at a deleted note). -->
  <div v-else-if="linkUnavailable" class="share-gate">
    <i class="bi bi-link-45deg share-gate-icon"></i>
    <h1>{{ t('share.unavailableTitle') }}</h1>
    <p>{{ t('share.unavailableBody') }}</p>
    <router-link class="btn btn-brand" to="/">{{ t('share.goToStudySync') }}</router-link>
  </div>

  <div v-else-if="note" :class="{ 'share-page': isShared }">
    <!-- Public chrome for shared links: the app shell is hidden on this route,
         so the brand + permission badge + sign-in CTA live here. -->
    <div v-if="isShared" class="share-topbar">
      <router-link to="/" class="share-brand"><i class="bi bi-mortarboard-fill"></i>StudySync</router-link>
      <div class="share-topbar-actions">
        <span class="badge-soft">
          <i class="bi" :class="canEdit ? 'bi-pencil' : 'bi-eye'"></i>
          {{ canEdit ? t('share.canEdit') : t('share.canView') }}
        </span>
        <span v-if="isAnon" class="share-guest-name">{{ me.full_name }}</span>
        <router-link v-if="isAnon" class="btn btn-brand" :to="{ name: 'login', query: { redirect: route.fullPath } }">
          {{ t('share.signIn') }}
        </router-link>
      </div>
    </div>

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
        <div class="eh-title-row">
          <h1
            v-if="canEdit"
            ref="titleEl"
            v-once
            class="eh-title eh-title-edit"
            contenteditable="true"
            spellcheck="false"
            :title="t('editor.renameHint')"
            @keydown.enter.prevent="$event.target.blur()"
            @blur="renameTitle"
          >{{ note.title }}</h1>
          <h1 v-else class="eh-title">{{ note.title }}</h1>
          <button
            v-if="canEdit && isAiConfigured"
            class="eh-title-gen"
            :disabled="titleBusy"
            :title="t('editor.generateTitle')"
            @click="generateTitleFromNote"
          ><i class="bi" :class="titleBusy ? 'bi-arrow-repeat spin' : 'bi-stars'"></i></button>
        </div>
      </div>
      <div class="eh-actions">
        <span v-if="canEdit" class="badge-live"><span class="dot-online"></span>{{ statusLabel }}</span>
        <span v-else class="badge-soft"><i class="bi bi-eye"></i> {{ t('share.readOnly') }}</span>
        <template v-if="!isShared">
          <button class="btn btn-outline-soft" @click="shareOpen = true"><i class="bi bi-share"></i>{{ t('editor.share') }}</button>
          <div class="export-menu-wrap">
            <button class="btn btn-outline-soft" :class="{ on: exportOpen }" @click="exportOpen = !exportOpen">
              <i class="bi bi-download"></i>{{ t('editor.export') }}<i class="bi bi-chevron-down export-caret"></i>
            </button>
            <template v-if="exportOpen">
              <div class="export-backdrop" @click="exportOpen = false"></div>
              <div class="export-menu" role="menu">
                <button class="export-item" :disabled="!!exportBusy" role="menuitem" @click="runExport('pdf')">
                  <i class="bi" :class="exportBusy === 'pdf' ? 'bi-arrow-repeat spin' : 'bi-file-earmark-pdf'"></i>
                  <span>{{ t('editor.exportPdf') }}</span>
                </button>
                <button class="export-item" :disabled="!!exportBusy" role="menuitem" @click="runExport('docx')">
                  <i class="bi" :class="exportBusy === 'docx' ? 'bi-arrow-repeat spin' : 'bi-file-earmark-word'"></i>
                  <span>{{ t('editor.exportWord') }}</span>
                </button>
              </div>
            </template>
          </div>
          <button class="btn btn-brand" @click="aiOpen = true"><i class="bi bi-stars"></i>{{ t('editor.aiTools') }}</button>
        </template>
      </div>
    </div>

    <!-- Toolbar (hidden when view-only) -->
    <div v-if="canEdit && editor" class="editor-toolbar2">
      <div class="tb-group">
        <button class="tb-btn" :title="tip('editor.undo', 'Ctrl+Z')" @click="chain().undo().run()"><i class="bi bi-arrow-counterclockwise"></i></button>
        <button class="tb-btn" :title="tip('editor.redo', 'Ctrl+Shift+Z')" @click="chain().redo().run()"><i class="bi bi-arrow-clockwise"></i></button>
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
        <button class="tb-btn" :class="{ on: isActive('bold') }" :title="tip('editor.bold', 'Ctrl+B')" @click="chain().toggleBold().run()"><i class="bi bi-type-bold"></i></button>
        <button class="tb-btn" :class="{ on: isActive('italic') }" :title="tip('editor.italic', 'Ctrl+I')" @click="chain().toggleItalic().run()"><i class="bi bi-type-italic"></i></button>
        <button class="tb-btn" :class="{ on: isActive('underline') }" :title="tip('editor.underline', 'Ctrl+U')" @click="chain().toggleUnderline().run()"><i class="bi bi-type-underline"></i></button>
        <button class="tb-btn" :class="{ on: isActive('strike') }" :title="tip('editor.strikethrough', 'Ctrl+Shift+S')" @click="chain().toggleStrike().run()"><i class="bi bi-type-strikethrough"></i></button>
        <label class="tb-btn tb-color" :title="t('editor.textColor')"><i class="bi bi-fonts"></i><input type="color" @input="chain().setColor($event.target.value).run()" /></label>
        <label class="tb-btn tb-color" :title="t('editor.highlight')"><i class="bi bi-highlighter"></i><input type="color" @input="chain().toggleHighlight({ color: $event.target.value }).run()" /></label>
      </div>
      <div class="tb-sep"></div>
      <div class="tb-group">
        <button class="tb-btn" :class="{ on: isActive('link'), disabled: uploadingLink }" :disabled="uploadingLink" :title="tip('editor.attachFile', 'Ctrl+K')" @click="setLink">
          <i class="bi" :class="uploadingLink ? 'bi-arrow-repeat spin' : 'bi-paperclip'"></i>
        </button>
        <input ref="linkInput" type="file" class="d-none" @change="onLinkFilePicked" />
        <button v-if="canComment" class="tb-btn" :class="{ disabled: !hasSelection }" :disabled="!hasSelection" :title="tip('editor.comment', 'Ctrl+Alt+M')" @click="startComment"><i class="bi bi-chat-left-text"></i></button>
        <button class="tb-btn" :class="{ disabled: uploadingImage }" :disabled="uploadingImage" :title="tip('editor.image', 'Ctrl+Alt+I')" @click="setImage">
          <i class="bi" :class="uploadingImage ? 'bi-arrow-repeat spin' : 'bi-image'"></i>
        </button>
        <input ref="imageInput" type="file" accept="image/*" class="d-none" @change="onImagePicked" />
      </div>

      <!-- AI assist (Gemini) — rewrite/explain/continue the selection -->
      <template v-if="isAiConfigured && canEdit">
        <div class="tb-sep"></div>
        <div class="tb-group table-menu-wrap">
          <button class="tb-btn ai-tb" :class="{ on: aiMenuOpen, disabled: aiBusy }" :disabled="aiBusy" :title="t('editor.aiAssist')" @click="aiMenuOpen = !aiMenuOpen">
            <i class="bi" :class="aiBusy ? 'bi-arrow-repeat spin' : 'bi-stars'"></i>
          </button>
          <template v-if="aiMenuOpen">
            <div class="export-backdrop" @click="aiMenuOpen = false"></div>
            <div class="table-menu" role="menu">
              <button class="export-item" @click="runRewrite('improve')"><i class="bi bi-magic"></i><span>{{ t('editor.aiImprove') }}</span></button>
              <button class="export-item" @click="runRewrite('fix')"><i class="bi bi-check2-circle"></i><span>{{ t('editor.aiFix') }}</span></button>
              <button class="export-item" @click="runRewrite('shorten')"><i class="bi bi-arrows-collapse"></i><span>{{ t('editor.aiShorten') }}</span></button>
              <button class="export-item" @click="runRewrite('expand')"><i class="bi bi-arrows-expand"></i><span>{{ t('editor.aiExpand') }}</span></button>
              <button class="export-item" @click="runRewrite('explain')"><i class="bi bi-lightbulb"></i><span>{{ t('editor.aiExplain') }}</span></button>
              <div class="table-menu-sep"></div>
              <button class="export-item" @click="runRewrite('continue')"><i class="bi bi-pencil-square"></i><span>{{ t('editor.aiContinue') }}</span></button>
            </div>
          </template>
        </div>
      </template>

      <div class="tb-sep"></div>
      <div class="tb-group">
        <button class="tb-btn" :class="{ on: isActive({ textAlign: 'left' }) }" :title="t('editor.alignLeft')" @click="chain().setTextAlign('left').run()"><i class="bi bi-text-left"></i></button>
        <button class="tb-btn" :class="{ on: isActive({ textAlign: 'center' }) }" :title="t('editor.alignCenter')" @click="chain().setTextAlign('center').run()"><i class="bi bi-text-center"></i></button>
        <button class="tb-btn" :class="{ on: isActive({ textAlign: 'right' }) }" :title="t('editor.alignRight')" @click="chain().setTextAlign('right').run()"><i class="bi bi-text-right"></i></button>
      </div>
      <div class="tb-sep"></div>
      <div class="tb-group">
        <button class="tb-btn" :class="{ on: isActive('taskList') }" :title="tip('editor.checklist', 'Ctrl+Shift+9')" @click="chain().toggleTaskList().run()"><i class="bi bi-check2-square"></i></button>
        <button class="tb-btn" :class="{ on: isActive('bulletList') }" :title="tip('editor.bulletList', 'Ctrl+Shift+8')" @click="chain().toggleBulletList().run()"><i class="bi bi-list-ul"></i></button>
        <button class="tb-btn" :class="{ on: isActive('orderedList') }" :title="tip('editor.numberList', 'Ctrl+Shift+7')" @click="chain().toggleOrderedList().run()"><i class="bi bi-list-ol"></i></button>
        <button class="tb-btn" :class="{ on: isActive('blockquote') }" :title="tip('editor.quote', 'Ctrl+Shift+B')" @click="chain().toggleBlockquote().run()"><i class="bi bi-quote"></i></button>
        <button class="tb-btn" :class="{ on: isActive('codeBlock') }" :title="tip('editor.codeBlock', 'Ctrl+Alt+C')" @click="chain().toggleCodeBlock().run()"><i class="bi bi-code-slash"></i></button>
        <button class="tb-btn" :title="t('editor.divider')" @click="chain().setHorizontalRule().run()"><i class="bi bi-dash-lg"></i></button>
        <button class="tb-btn" :title="tip('editor.clearFormat', 'Ctrl+\\')" @click="chain().unsetAllMarks().clearNodes().run()"><i class="bi bi-eraser"></i></button>
      </div>
      <div class="tb-sep"></div>
      <!-- Data table: insert, plus contextual row/column tools when inside one -->
      <div class="tb-group">
        <button class="tb-btn" :class="{ on: inTable }" :title="tip('editor.insertTable', 'Ctrl+Alt+T')" @click="insertTable"><i class="bi bi-table"></i></button>
        <button class="tb-btn" :class="{ disabled: importingData }" :disabled="importingData" :title="t('editor.importData')" @click="importData">
          <i class="bi" :class="importingData ? 'bi-arrow-repeat spin' : 'bi-file-earmark-spreadsheet'"></i>
        </button>
        <input ref="dataInput" type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" class="d-none" @change="onDataFilePicked" />
        <div v-if="inTable" class="table-menu-wrap">
          <button class="tb-btn" :class="{ on: tableMenuOpen }" :title="t('editor.tableTools')" @click="tableMenuOpen = !tableMenuOpen"><i class="bi bi-sliders"></i></button>
          <template v-if="tableMenuOpen">
            <div class="export-backdrop" @click="tableMenuOpen = false"></div>
            <div class="table-menu" role="menu">
              <button class="export-item" @click="tableCmd(c => c.addColumnBefore())"><i class="bi bi-arrow-bar-left"></i><span>{{ t('editor.colBefore') }}</span></button>
              <button class="export-item" @click="tableCmd(c => c.addColumnAfter())"><i class="bi bi-arrow-bar-right"></i><span>{{ t('editor.colAfter') }}</span></button>
              <button class="export-item" @click="tableCmd(c => c.deleteColumn())"><i class="bi bi-x-square"></i><span>{{ t('editor.delCol') }}</span></button>
              <div class="table-menu-sep"></div>
              <button class="export-item" @click="tableCmd(c => c.addRowBefore())"><i class="bi bi-arrow-bar-up"></i><span>{{ t('editor.rowBefore') }}</span></button>
              <button class="export-item" @click="tableCmd(c => c.addRowAfter())"><i class="bi bi-arrow-bar-down"></i><span>{{ t('editor.rowAfter') }}</span></button>
              <button class="export-item" @click="tableCmd(c => c.deleteRow())"><i class="bi bi-x-square"></i><span>{{ t('editor.delRow') }}</span></button>
              <div class="table-menu-sep"></div>
              <button class="export-item" @click="tableCmd(c => c.toggleHeaderRow())"><i class="bi bi-table"></i><span>{{ t('editor.toggleHeader') }}</span></button>
              <button class="export-item" @click="tableCmd(c => c.mergeOrSplit())"><i class="bi bi-union"></i><span>{{ t('editor.mergeSplit') }}</span></button>
              <button class="export-item danger" @click="tableCmd(c => c.deleteTable())"><i class="bi bi-trash3"></i><span>{{ t('editor.delTable') }}</span></button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Document + side panel -->
    <div class="editor-grid">
      <EditorContent :editor="editor" class="doc-surface" @click="onSurfaceClick" />

      <div class="side-panel">
        <!-- Guests get presence only: comments and history are account features. -->
        <div class="seg-tabs">
          <button class="seg-tab" :class="{ active: activeTab==='online' }" @click="activeTab='online'">{{ t('editor.online') }}</button>
          <template v-if="canComment">
            <button class="seg-tab" :class="{ active: activeTab==='comments' }" @click="activeTab='comments'">{{ t('editor.comments') }}</button>
            <button class="seg-tab" :class="{ active: activeTab==='history' }" @click="activeTab='history'; refreshHistory()">{{ t('editor.history') }}</button>
          </template>
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
