<script setup>
/**
 * AppDialogs — single host for the app's in-app toast / confirm / prompt UI,
 * driven by the dialogStore. Mounted once in App.vue so any component can call
 * dialog.toast / dialog.confirm / dialog.promptText without its own markup.
 */
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogStore } from '../../stores/dialogStore.js'

const dialog = useDialogStore()
const { t } = useI18n()

const promptValue = ref('')
const promptInput = ref(null)

// Seed + focus the prompt input whenever a prompt opens.
watch(() => dialog.promptOpts, async (o) => {
  if (o) {
    promptValue.value = o.value || ''
    await nextTick()
    promptInput.value?.focus()
    promptInput.value?.select()
  }
})

const toastIcon = (type) => ({
  success: 'bi-check-circle-fill',
  error: 'bi-exclamation-octagon-fill',
  warning: 'bi-exclamation-triangle-fill',
  info: 'bi-info-circle-fill'
}[type] || 'bi-info-circle-fill')
</script>

<template>
  <!-- Toasts -->
  <div class="toast-host" aria-live="polite">
    <div v-for="tt in dialog.toasts" :key="tt.id" class="app-toast" :class="`toast-${tt.type}`">
      <i class="bi" :class="toastIcon(tt.type)"></i>
      <span class="toast-msg">{{ tt.message }}</span>
      <button class="toast-x" :aria-label="t('common.close')" @click="dialog.dismiss(tt.id)"><i class="bi bi-x-lg"></i></button>
    </div>
  </div>

  <!-- Confirm dialog -->
  <div v-if="dialog.confirmOpts" class="modal d-block" tabindex="-1" style="background: rgba(15,23,42,.5)" @click.self="dialog._settleConfirm(false)">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i v-if="dialog.confirmOpts.danger" class="bi bi-exclamation-triangle text-danger me-2"></i>
            {{ dialog.confirmOpts.title || t('common.confirmTitle') }}
          </h5>
          <button class="btn-close" :aria-label="t('common.close')" @click="dialog._settleConfirm(false)"></button>
        </div>
        <div class="modal-body">
          <p class="mb-0">{{ dialog.confirmOpts.message }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-soft" @click="dialog._settleConfirm(false)">{{ dialog.confirmOpts.cancelText || t('common.cancel') }}</button>
          <button :class="dialog.confirmOpts.danger ? 'btn btn-danger' : 'btn btn-brand'" @click="dialog._settleConfirm(true)">
            {{ dialog.confirmOpts.confirmText || t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Prompt dialog (single-line text) -->
  <div v-if="dialog.promptOpts" class="modal d-block" tabindex="-1" style="background: rgba(15,23,42,.5)" @click.self="dialog._settlePrompt(null)">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ dialog.promptOpts.title || t('common.promptTitle') }}</h5>
          <button class="btn-close" :aria-label="t('common.close')" @click="dialog._settlePrompt(null)"></button>
        </div>
        <div class="modal-body">
          <label v-if="dialog.promptOpts.label" class="form-label">{{ dialog.promptOpts.label }}</label>
          <input
            ref="promptInput"
            v-model="promptValue"
            class="form-control"
            :placeholder="dialog.promptOpts.placeholder"
            @keydown.enter.prevent="dialog._settlePrompt(promptValue)"
            @keydown.esc.prevent="dialog._settlePrompt(null)"
          />
        </div>
        <div class="modal-footer">
          <button class="btn btn-soft" @click="dialog._settlePrompt(null)">{{ t('common.cancel') }}</button>
          <button class="btn btn-brand" @click="dialog._settlePrompt(promptValue)">{{ dialog.promptOpts.confirmText || t('common.ok') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
