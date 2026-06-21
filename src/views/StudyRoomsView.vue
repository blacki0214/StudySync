<script setup>
/** StudyRoomsView — list of live/idle study rooms. Layout uses row/col grid;
 *  other styling is semantic classes in styles/study-room.css. */
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContentStore } from '../stores/contentStore.js'

const { t } = useI18n()
const content = useContentStore()
onMounted(() => content.ensureLoaded())

function subjectCode(id) {
  return content.subjectById(id)?.code || 'General'
}
</script>

<template>
  <div>
    <header class="page-header">
      <h1>{{ t('rooms.title') }}</h1>
      <p>{{ t('rooms.sub') }}</p>
    </header>

    <div class="row g-4">
      <div v-for="room in content.rooms" :key="room.id" class="col-12 col-md-6 col-xl-4">
        <div class="room-card">
          <div class="rc-top">
            <span class="badge-soft">{{ subjectCode(room.subject_id) }}</span>
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
  </div>
</template>
