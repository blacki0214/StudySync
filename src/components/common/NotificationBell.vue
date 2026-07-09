<script setup>
/**
 * NotificationBell — the sidebar bell + its notification panel. Shows an unread
 * count badge and a popover list of deadline alerts and recent activity, all
 * from notificationStore. Closes on outside-click or Escape.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '../../stores/notificationStore.js'
import { useContentStore } from '../../stores/contentStore.js'

const { t } = useI18n()
const router = useRouter()
const notif = useNotificationStore()
const content = useContentStore()

const root = ref(null)
const unread = computed(() => notif.unreadCount)

function actorName(id) {
  return content.userById(id)?.full_name || t('editor.someone')
}
function deadlineText(item) {
  if (item.overdue) return t('notif.overdue')
  if (item.days === 0) return t('notif.dueToday')
  if (item.days === 1) return t('notif.dueTomorrow')
  return t('notif.dueInDays', { n: item.days })
}
const isRead = (id) => notif.readIds.has(id)

function openItem(item) {
  notif.markRead(item.id)
  notif.close()
  if (item.to) router.push(item.to)
}

function onDocClick(e) {
  if (notif.open && root.value && !root.value.contains(e.target)) notif.close()
}
function onKey(e) {
  if (notif.open && e.key === 'Escape') notif.close()
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="notif-wrap">
    <button class="sidebar-ctl" :aria-label="t('nav.notifications')" :title="t('nav.notifications')" @click.stop="notif.toggle()">
      <i class="bi bi-bell"></i>
      <span v-if="unread" class="notif-badge">{{ unread > 9 ? '9+' : unread }}</span>
    </button>

    <div v-if="notif.open" class="notif-panel">
      <div class="notif-head">
        <span class="notif-title">{{ t('nav.notifications') }}</span>
        <button v-if="unread" class="notif-readall" @click="notif.markAllRead()">{{ t('notif.markAllRead') }}</button>
      </div>

      <div class="notif-list">
        <p v-if="!notif.items.length" class="notif-empty">
          <i class="bi bi-check2-circle"></i>{{ t('notif.empty') }}
        </p>

        <button
          v-for="item in notif.items"
          :key="item.id"
          class="notif-item"
          :class="{ unread: !isRead(item.id) }"
          @click="openItem(item)"
        >
          <span class="notif-icon" :style="{ background: item.color }"><i class="bi" :class="item.icon"></i></span>
          <span class="notif-body">
            <template v-if="item.kind === 'deadline'">
              <span class="notif-text"><strong>{{ deadlineText(item) }}</strong> · {{ item.title }}</span>
              <span class="notif-sub">{{ item.subject }}</span>
            </template>
            <template v-else>
              <span class="notif-text">{{ t(item.key, { user: actorName(item.actorId), ...item.params }) }}</span>
              <span class="notif-sub">{{ item.ago }}</span>
            </template>
          </span>
          <span v-if="!isRead(item.id)" class="notif-unread-dot"></span>
        </button>
      </div>
    </div>
  </div>
</template>
