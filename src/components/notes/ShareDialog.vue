<script setup>
/**
 * ShareDialog — turn a note into a shareable link with a permission (view or
 * edit). Anyone with the link — including signed-out visitors — can open it;
 * "Can edit" links let them edit live. Mirrors the Google-Docs share flow.
 */
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { noteService } from '../../services/noteService.js'
import AppSelect from '../common/AppSelect.vue'

const props = defineProps({ note: { type: Object, required: true } })
const emit = defineEmits(['close'])
const { t } = useI18n()

const enabled = ref(!!props.note.share_enabled)
const permission = ref(props.note.share_permission || 'read')
const saving = ref(false)
const copied = ref(false)

const link = computed(() =>
  typeof window !== 'undefined' ? `${window.location.origin}/share/${props.note.id}` : ''
)
const permissionOptions = computed(() => [
  { value: 'read', label: t('share.canView') },
  { value: 'edit', label: t('share.canEdit') }
])

async function persist() {
  saving.value = true
  try {
    await noteService.setShare(props.note.id, { enabled: enabled.value, permission: permission.value })
    props.note.share_enabled = enabled.value
    props.note.share_permission = permission.value
  } finally {
    saving.value = false
  }
}
function toggle() { enabled.value = !enabled.value; persist() }
function onPermission() { persist() }
function copy() {
  navigator.clipboard?.writeText(link.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="modal d-block" tabindex="-1" style="background: rgba(15,23,42,.5)" @click.self="emit('close')">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="bi bi-share"></i> {{ t('share.title') }}</h5>
          <button class="btn-close" @click="emit('close')"></button>
        </div>
        <div class="modal-body">
          <div class="share-toggle">
            <div>
              <div class="share-toggle-label">{{ t('share.anyoneWithLink') }}</div>
              <div class="share-toggle-sub">{{ enabled ? t('share.onHint') : t('share.offHint') }}</div>
            </div>
            <button class="switch" :class="{ on: enabled }" :disabled="saving" @click="toggle">
              <span class="switch-knob"></span>
            </button>
          </div>

          <template v-if="enabled">
            <div class="form-group share-perm">
              <label>{{ t('share.permission') }}</label>
              <AppSelect v-model="permission" :options="permissionOptions" :aria-label="t('share.permission')" @update:model-value="onPermission" />
            </div>
            <div class="form-group">
              <label>{{ t('share.link') }}</label>
              <div class="share-link-row">
                <input :value="link" readonly class="form-control" @focus="$event.target.select()" />
                <button class="btn btn-brand" @click="copy"><i class="bi" :class="copied ? 'bi-check2' : 'bi-clipboard'"></i>{{ copied ? t('classes.copied') : t('share.copy') }}</button>
              </div>
            </div>
          </template>
        </div>
        <div class="modal-footer">
          <button class="btn btn-brand" @click="emit('close')">{{ t('share.done') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
