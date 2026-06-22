<script setup>
/**
 * TasksView — the personal "My Tasks" page. Renders the shared TaskManager with
 * no subject scope, so it shows the signed-in user's own tasks.
 */
import { useI18n } from 'vue-i18n'
import TaskManager from '../components/tasks/TaskManager.vue'

const { t } = useI18n()
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1 class="ph-title"><i class="bi bi-check2-square"></i> {{ t('tasks.title') }}</h1>
        <p class="ph-sub">{{ t('tasks.subtitle') }}</p>
      </div>
    </div>

    <TaskManager />
  </div>
</template>
