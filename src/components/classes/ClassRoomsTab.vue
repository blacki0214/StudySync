<script setup>
/**
 * ClassRoomsTab — study rooms that belong to a class (Phase 2). Any member can
 * spin one up for a live session or group work; it opens the Discord-style room.
 * Class rooms are tagged with class_id, so they never show in the personal
 * Study Rooms list.
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useContentStore } from '../../stores/contentStore.js'
import { useDialogStore } from '../../stores/dialogStore.js'
import EmptyState from '../common/EmptyState.vue'

const props = defineProps({ classId: { type: String, required: true } })
const { t } = useI18n()
const router = useRouter()
const content = useContentStore()
const dialog = useDialogStore()

const creating = ref(false)
const rooms = computed(() => content.rooms.filter((r) => r.class_id === props.classId))

onMounted(() => content.ensureLoaded())

async function create() {
  const name = await dialog.promptText({
    title: t('classes.newRoom'),
    label: t('rooms.nameLabel'),
    placeholder: t('rooms.namePlaceholder')
  })
  if (!name || !name.trim()) return
  creating.value = true
  try {
    const room = await content.createRoom({ name: name.trim(), classId: props.classId })
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
    <div class="tab-toolbar">
      <button class="btn btn-brand btn-sm" :disabled="creating" @click="create"><i class="bi bi-plus-lg"></i>{{ t('classes.newRoom') }}</button>
    </div>

    <EmptyState v-if="!rooms.length" icon="bi-people" :title="t('classes.noRooms')" :message="t('classes.noRoomsMsg')" />
    <div v-else class="row g-4">
      <div v-for="room in rooms" :key="room.id" class="col-12 col-md-6 col-xl-4">
        <div class="room-card">
          <div class="rc-top">
            <span class="badge-soft"><i class="bi bi-hash"></i> {{ room.name }}</span>
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
