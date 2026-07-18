<script setup>
/**
 * StudyRoomsView — list of study rooms with the ability to CREATE one. A room
 * is a casual, student-run space (text + voice channel) — unlike a Class, which
 * has assignments and a gradebook. Anyone can spin one up and others can join.
 * Layout uses row/col grid; styling is semantic classes in styles/study-room.css.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useContentStore } from '../stores/contentStore.js'
import { useDialogStore } from '../stores/dialogStore.js'
import AppSelect from '../components/common/AppSelect.vue'

const { t } = useI18n()
const router = useRouter()
const content = useContentStore()
const dialog = useDialogStore()

onMounted(() => content.ensureLoaded())

// All the user's rooms — their personal rooms plus rooms from classes they're
// in (class rooms are tagged in the card).
const rooms = computed(() => content.rooms)

function subjectCode(id) {
  return content.subjectById(id)?.code || 'General'
}

const subjectOptions = computed(() => [
  { value: '', label: t('rooms.noSubject') },
  ...content.subjects.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))
])

// --- Create room ---
const showCreate = ref(false)
const form = ref({ name: '', description: '', subjectId: '' })
const creating = ref(false)

function openCreate() {
  form.value = { name: '', description: '', subjectId: '' }
  showCreate.value = true
}

// --- Join via invite link ---
// Accepts a full room URL or a raw room id; extracts the id and opens the room
// (entering it records membership, so it then appears in this list).
function extractRoomId(input) {
  const url = String(input || '').trim()
  const fromLink = url.match(/rooms\/([0-9a-fA-F-]{8,})/)
  if (fromLink) return fromLink[1]
  return /^[0-9a-fA-F-]{8,}$/.test(url) ? url : ''
}
async function joinByLink() {
  const input = await dialog.promptText({
    title: t('rooms.joinByLinkTitle'),
    label: t('rooms.joinByLinkLabel'),
    placeholder: `${window.location.origin}/rooms/…`
  })
  if (input === null) return
  const id = extractRoomId(input)
  if (!id) { dialog.toast(t('rooms.joinByLinkInvalid'), 'error'); return }
  router.push(`/rooms/${id}`)
}
async function submitCreate() {
  if (!form.value.name.trim()) return
  creating.value = true
  try {
    const room = await content.createRoom({
      name: form.value.name,
      description: form.value.description,
      subjectId: form.value.subjectId || null
    })
    showCreate.value = false
    dialog.toast(t('rooms.created'), 'success')
    router.push(`/rooms/${room.id}`)
  } catch (e) {
    dialog.toast(e.message || t('rooms.createFailed'), 'error')
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div>
    <header class="page-head">
      <div>
        <h1 class="ph-title">{{ t('rooms.title') }}</h1>
        <p class="ph-sub">{{ t('rooms.sub') }}</p>
      </div>
      <div class="action-row">
        <button class="btn btn-outline-soft" @click="joinByLink"><i class="bi bi-box-arrow-in-right"></i>{{ t('rooms.joinByLink') }}</button>
        <button class="btn btn-brand" @click="openCreate"><i class="bi bi-plus-lg"></i>{{ t('rooms.create') }}</button>
      </div>
    </header>

    <!-- Empty state -->
    <div v-if="!rooms.length" class="rooms-empty">
      <i class="bi bi-people"></i>
      <h3>{{ t('rooms.emptyTitle') }}</h3>
      <p>{{ t('rooms.emptySub') }}</p>
      <button class="btn btn-brand" @click="openCreate"><i class="bi bi-plus-lg"></i>{{ t('rooms.create') }}</button>
    </div>

    <div v-else class="row g-4">
      <div v-for="room in rooms" :key="room.id" class="col-12 col-md-6 col-xl-4">
        <div class="room-card">
          <div class="rc-top">
            <span v-if="room.class_id" class="badge-soft room-class-tag"><i class="bi bi-mortarboard"></i> {{ t('rooms.classTag') }}</span>
            <span v-else class="badge-soft">{{ subjectCode(room.subject_id) }}</span>
            <span v-if="room.live" class="live-tag"><span class="live-dot"></span>{{ t('nav.live').toUpperCase() }}</span>
          </div>
          <div class="rc-name">{{ room.name }}</div>
          <div class="rc-desc">{{ room.description }}</div>
          <div class="rc-foot">
            <span class="rc-students"><i class="bi bi-people"></i>{{ t('rooms.studentsCount', { n: room.active_users }) }}</span>
            <router-link :to="`/rooms/${room.id}`" class="btn btn-brand btn-sm">
              <i class="bi bi-box-arrow-in-right"></i>{{ t('rooms.join') }}
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Create room modal -->
    <div v-if="showCreate" class="room-modal-backdrop" @click.self="showCreate = false">
      <div class="room-modal" role="dialog" aria-modal="true">
        <div class="rm-head">
          <h3>{{ t('rooms.createTitle') }}</h3>
          <button class="btn-icon-sq" :aria-label="t('common.cancel')" @click="showCreate = false"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="rm-body">
          <label class="rm-label">{{ t('rooms.nameLabel') }}</label>
          <input v-model="form.name" class="rm-input" :placeholder="t('rooms.namePlaceholder')" @keyup.enter="submitCreate" autofocus />

          <label class="rm-label">{{ t('rooms.descLabel') }}</label>
          <textarea v-model="form.description" class="rm-input" rows="2" :placeholder="t('rooms.descPlaceholder')"></textarea>

          <label class="rm-label">{{ t('rooms.subjectLabel') }}</label>
          <AppSelect v-model="form.subjectId" :options="subjectOptions" :aria-label="t('rooms.subjectLabel')" />
        </div>
        <div class="rm-foot">
          <button class="btn btn-outline-soft" @click="showCreate = false">{{ t('common.cancel') }}</button>
          <button class="btn btn-brand" :disabled="creating || !form.name.trim()" @click="submitCreate">
            <i class="bi" :class="creating ? 'bi-arrow-repeat spin' : 'bi-plus-lg'"></i>{{ t('rooms.create') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
