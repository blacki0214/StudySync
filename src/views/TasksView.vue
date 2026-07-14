<script setup>
/**
 * TasksView — the "My Tasks" page. A scope switcher lets the user move between
 * their GENERAL (personal) tasks and the tasks of each of their subjects, all
 * from one place. Each scope drives the shared TaskManager (and its own custom
 * statuses). Subject boards are also reachable from the subject workspace.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSubjectStore } from '../stores/subjectStore.js'
import TaskManager from '../components/tasks/TaskManager.vue'
import SubjectIcon from '../components/subjects/SubjectIcon.vue'

const { t } = useI18n()
const subjectStore = useSubjectStore()

// null = general/personal board; otherwise a subject id.
const activeSubject = ref(null)

onMounted(() => { if (!subjectStore.subjects.length) subjectStore.fetchSubjects() })

const mySubjects = computed(() => subjectStore.mySubjects)
const activeName = computed(() =>
  activeSubject.value ? (subjectStore.getById(activeSubject.value)?.name || '') : t('tasks.general')
)
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1 class="ph-title"><i class="bi bi-check2-square"></i> {{ t('tasks.title') }}</h1>
        <p class="ph-sub">{{ t('tasks.subtitle') }}</p>
      </div>
    </div>

    <!-- Scope switcher: General + each subject -->
    <div class="task-scope-bar">
      <button class="task-scope" :class="{ active: activeSubject === null }" @click="activeSubject = null">
        <span class="task-scope-general"><i class="bi bi-inbox"></i></span>
        <span class="task-scope-name">{{ t('tasks.general') }}</span>
      </button>
      <button
        v-for="s in mySubjects"
        :key="s.id"
        class="task-scope"
        :class="{ active: activeSubject === s.id }"
        @click="activeSubject = s.id"
      >
        <SubjectIcon :subject="s" tile-class="task-scope-badge" />
        <span class="task-scope-name">{{ s.name }}</span>
      </button>
    </div>

    <!-- The board for the active scope. Keyed so switching fully resets it. -->
    <TaskManager :key="activeSubject || 'general'" :subject-id="activeSubject" />
  </div>
</template>
