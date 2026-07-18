<script setup>
/**
 * ClassDetailView — one class. The owner (teacher) sees the join code, can post
 * announcements and manage the roster (promote to TA / remove). Enrolled
 * students see the roster and announcements read-only. Class-scoped notes/rooms
 * and the gradebook arrive in Phase 3.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogStore } from '../stores/dialogStore.js'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/authStore.js'
import { useClassStore } from '../stores/classStore.js'
import { classService } from '../services/classService.js'
import { timeAgo } from '../utils/formatDate.js'
import LoadingSpinner from '../components/common/LoadingSpinner.vue'
import EmptyState from '../components/common/EmptyState.vue'
import ClassNotesTab from '../components/classes/ClassNotesTab.vue'
import ClassSubjectsTab from '../components/classes/ClassSubjectsTab.vue'
import ClassRoomsTab from '../components/classes/ClassRoomsTab.vue'
import ClassSlidesTab from '../components/classes/ClassSlidesTab.vue'
import ClassQuizzesTab from '../components/classes/ClassQuizzesTab.vue'
import ClassDiscussionsTab from '../components/classes/ClassDiscussionsTab.vue'
import ClassAttendanceTab from '../components/classes/ClassAttendanceTab.vue'
import ClassAnalyticsTab from '../components/classes/ClassAnalyticsTab.vue'
import ClassDocumentsTab from '../components/classes/ClassDocumentsTab.vue'
import ClassAssignmentsTab from '../components/classes/ClassAssignmentsTab.vue'
import ClassGradebookTab from '../components/classes/ClassGradebookTab.vue'

const props = defineProps({ id: { type: String, required: true } })
const { t } = useI18n()
const dialog = useDialogStore()
const router = useRouter()
const auth = useAuthStore()
const classStore = useClassStore()

const ready = ref(false)
const cls = ref(null)
const roster = ref([])
const announcements = ref([])
const tab = ref('announcements')
const draft = ref('')
const posting = ref(false)
const copied = ref(false)

const isOwner = computed(() => cls.value && cls.value.owner_id === auth.user?.id)
// Teaching Assistants can manage class content too (not just the owner).
const myRole = computed(() => roster.value.find((m) => m.user_id === auth.user?.id)?.role)
const canManage = computed(() => isOwner.value || myRole.value === 'ta')

// Icon + label for each class-workspace tab. Teacher/TA-only tabs are appended.
const tabs = computed(() => {
  const base = [
    { id: 'announcements', label: 'classes.announcements', icon: 'bi-megaphone' },
    { id: 'subjects', label: 'classes.subjects', icon: 'bi-journal-bookmark' },
    { id: 'notes', label: 'classes.notes', icon: 'bi-file-earmark-text' },
    { id: 'rooms', label: 'classes.rooms', icon: 'bi-camera-video' },
    { id: 'slides', label: 'classes.slides', icon: 'bi-easel' },
    { id: 'documents', label: 'classes.documents', icon: 'bi-folder2' },
    { id: 'assignments', label: 'classes.assignments', icon: 'bi-card-checklist' },
    { id: 'quizzes', label: 'classes.quizzes', icon: 'bi-patch-question' },
    { id: 'discussions', label: 'classes.discussions', icon: 'bi-chat-square-text' },
    { id: 'roster', label: 'classes.roster', icon: 'bi-people', count: roster.value.length }
  ]
  if (canManage.value) {
    base.push(
      { id: 'attendance', label: 'classes.attendance', icon: 'bi-calendar-check' },
      { id: 'analytics', label: 'classes.analytics', icon: 'bi-graph-up' },
      { id: 'gradebook', label: 'classes.gradebook', icon: 'bi-table' }
    )
  }
  return base
})

onMounted(async () => {
  cls.value = await classService.getClass(props.id)
  if (cls.value) {
    roster.value = await classService.getRoster(props.id)
    announcements.value = await classService.listAnnouncements(props.id)
  }
  ready.value = true
})

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
function copyCode() {
  navigator.clipboard?.writeText(cls.value.code)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

async function post() {
  if (!draft.value.trim()) return
  posting.value = true
  try {
    const row = await classService.postAnnouncement({
      classId: props.id, authorId: auth.user?.id, authorName: auth.user?.full_name, body: draft.value
    })
    announcements.value.unshift(row)
    draft.value = ''
  } finally {
    posting.value = false
  }
}
async function removeAnnouncement(a) {
  await classService.deleteAnnouncement(a.id)
  announcements.value = announcements.value.filter((x) => x.id !== a.id)
}
async function removeMember(m) {
  if (!(await dialog.confirm({ message: t('classes.confirmRemove'), danger: true, confirmText: t('common.delete') }))) return
  await classService.removeMember(m)
  roster.value = roster.value.filter((x) => x.id !== m.id)
}
async function toggleTa(m) {
  const role = m.role === 'ta' ? 'member' : 'ta'
  await classService.setMemberRole(m, role)
  m.role = role
}
async function destroy() {
  if (!(await dialog.confirm({ message: t('classes.confirmDelete'), danger: true, confirmText: t('common.delete') }))) return
  await classStore.deleteClass(props.id)
  router.push('/classes')
}
</script>

<template>
  <LoadingSpinner v-if="!ready" />

  <div v-else-if="!cls" class="empty-state">
    <i class="bi bi-folder-x empty-icon"></i>
    <p>{{ t('classes.notFound') }}</p>
    <router-link to="/classes" class="btn btn-brand">{{ t('classes.title') }}</router-link>
  </div>

  <div v-else>
    <header class="page-head">
      <div class="ws-head">
        <span class="icon-tile ws-badge" :class="cls.color">{{ initials(cls.name) }}</span>
        <div>
          <h1 class="ph-title">{{ cls.name }}</h1>
          <p class="ph-sub">{{ cls.description || t('classes.noDesc') }}</p>
        </div>
      </div>
      <div class="action-row">
        <button class="btn btn-outline-soft" @click="copyCode">
          <i class="bi" :class="copied ? 'bi-check2' : 'bi-key'"></i>
          {{ copied ? t('classes.copied') : cls.code }}
        </button>
        <button v-if="isOwner" class="btn btn-outline-soft text-danger" @click="destroy"><i class="bi bi-trash"></i>{{ t('classes.delete') }}</button>
      </div>
    </header>

    <nav class="class-tabs">
      <button
        v-for="tb in tabs"
        :key="tb.id"
        class="class-tab"
        :class="{ active: tab === tb.id }"
        @click="tab = tb.id"
      >
        <i class="bi" :class="tb.icon"></i>
        <span>{{ t(tb.label) }}</span>
        <span v-if="tb.count != null" class="class-tab-count">{{ tb.count }}</span>
      </button>
    </nav>

    <!-- Announcements -->
    <div v-if="tab==='announcements'" class="row g-4">
      <div class="col-12 col-xl-8">
        <div v-if="isOwner" class="composer">
          <div class="cp-row">
            <span class="user-avatar composer-avatar">{{ initials(auth.displayName) }}</span>
            <input v-model="draft" :placeholder="t('classes.announcePlaceholder')" @keyup.enter="post" />
          </div>
          <div class="cp-foot">
            <button class="btn btn-brand btn-sm" :disabled="posting || !draft.trim()" @click="post">
              <span v-if="posting" class="spinner-border spinner-border-sm"></span><i v-else class="bi bi-send"></i>{{ t('classes.post') }}
            </button>
          </div>
        </div>

        <EmptyState v-if="!announcements.length" icon="bi-megaphone" :title="t('classes.noAnnouncements')" />
        <div v-for="a in announcements" :key="a.id" class="announce-card">
          <div class="announce-head">
            <span class="user-avatar announce-avatar">{{ initials(a.author?.full_name) }}</span>
            <span class="announce-author">{{ a.author?.full_name || t('classes.teacher') }}</span>
            <span class="announce-ago">· {{ timeAgo(a.created_at) }}</span>
            <button v-if="isOwner" class="announce-del" @click="removeAnnouncement(a)"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="announce-body">{{ a.body }}</div>
        </div>
      </div>
    </div>

    <!-- Subjects / Notes / Rooms / Documents / Assignments / Gradebook -->
    <ClassSubjectsTab v-else-if="tab==='subjects'" :class-id="props.id" :can-manage="canManage" />
    <ClassNotesTab v-else-if="tab==='notes'" :class-id="props.id" />
    <ClassRoomsTab v-else-if="tab==='rooms'" :class-id="props.id" />
    <ClassSlidesTab v-else-if="tab==='slides'" :class-id="props.id" :can-manage="canManage" />
    <ClassDocumentsTab v-else-if="tab==='documents'" :class-id="props.id" />
    <ClassAssignmentsTab v-else-if="tab==='assignments'" :class-id="props.id" :is-owner="isOwner" />
    <ClassQuizzesTab v-else-if="tab==='quizzes'" :class-id="props.id" :can-manage="canManage" />
    <ClassDiscussionsTab v-else-if="tab==='discussions'" :class-id="props.id" />
    <ClassAttendanceTab v-else-if="tab==='attendance' && canManage" :class-id="props.id" :roster="roster" />
    <ClassAnalyticsTab v-else-if="tab==='analytics' && canManage" :class-id="props.id" :roster="roster" />
    <ClassGradebookTab v-else-if="tab==='gradebook' && canManage" :class-id="props.id" />

    <!-- Roster -->
    <div v-else-if="tab==='roster'">
      <EmptyState v-if="!roster.length" icon="bi-people" :title="t('classes.noStudents')" :message="isOwner ? t('classes.shareCode', { code: cls.code }) : ''" />
      <div v-else class="panel roster">
        <div v-for="m in roster" :key="m.id" class="roster-row">
          <span class="user-avatar roster-avatar">{{ initials(m.profile?.full_name) }}</span>
          <span class="roster-name">{{ m.profile?.full_name || t('classes.student') }}</span>
          <span v-if="m.role === 'ta'" class="badge-soft">{{ t('classes.ta') }}</span>
          <span class="roster-spacer"></span>
          <template v-if="isOwner">
            <button class="btn btn-outline-soft btn-sm" @click="toggleTa(m)">{{ m.role === 'ta' ? t('classes.makeMember') : t('classes.makeTa') }}</button>
            <button class="btn btn-outline-soft btn-sm text-danger" @click="removeMember(m)"><i class="bi bi-person-dash"></i></button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
