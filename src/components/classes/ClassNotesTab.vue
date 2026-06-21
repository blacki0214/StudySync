<script setup>
/**
 * ClassNotesTab — collaborative notes shared with a class. Any member can create
 * one (it opens straight in the editor) and open existing ones.
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { noteService } from '../../services/noteService.js'
import { useNoteStore } from '../../stores/noteStore.js'
import { timeAgo } from '../../utils/formatDate.js'
import EmptyState from '../common/EmptyState.vue'

const props = defineProps({ classId: { type: String, required: true } })
const { t } = useI18n()
const router = useRouter()
const noteStore = useNoteStore()

const notes = ref([])
const creating = ref(false)
const title = ref('')
const showForm = ref(false)

onMounted(async () => { notes.value = await noteService.listNotes({ classId: props.classId }) })

async function create() {
  if (!title.value.trim()) return
  creating.value = true
  try {
    const note = await noteStore.createNote({ classId: props.classId, subjectId: null, title: title.value.trim(), content: '' })
    router.push({ name: 'note-detail', params: { id: note.id } })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div>
    <div class="tab-toolbar">
      <button class="btn btn-brand btn-sm" @click="showForm = !showForm"><i class="bi bi-plus-lg"></i>{{ t('classes.newNote') }}</button>
    </div>

    <div v-if="showForm" class="inline-create">
      <input v-model="title" class="form-control" :placeholder="t('classes.noteTitlePlaceholder')" @keyup.enter="create" />
      <button class="btn btn-brand" :disabled="creating || !title.trim()" @click="create">
        <span v-if="creating" class="spinner-border spinner-border-sm"></span>{{ t('classes.create') }}
      </button>
    </div>

    <EmptyState v-if="!notes.length" icon="bi-file-earmark-text" :title="t('classes.noNotes')" />
    <div v-else class="panel roster">
      <router-link v-for="n in notes" :key="n.id" :to="{ name: 'note-detail', params: { id: n.id } }" class="roster-row class-list-row">
        <span class="doc-icon"><i class="bi bi-file-earmark-text"></i></span>
        <span class="roster-name">{{ n.title }}</span>
        <span class="roster-spacer"></span>
        <span class="announce-ago">{{ timeAgo(n.updated_at) }}</span>
      </router-link>
    </div>
  </div>
</template>
