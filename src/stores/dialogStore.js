/**
 * dialogStore.js
 * ----------------------------------------------------------------------------
 * App-wide, in-app replacements for the browser's native alert/confirm/prompt
 * (which render an ugly "<host> says" popup). Components call these and render
 * via <AppDialogs> (mounted once in App.vue):
 *
 *   const dialog = useDialogStore()
 *   dialog.toast('Saved', 'success')
 *   if (await dialog.confirm({ message: 'Delete this?' })) { … }
 *   const name = await dialog.promptText({ label: 'Alt text' })   // string | null
 *
 * The pending confirm/prompt resolver lives in module scope (not store state)
 * because a Promise resolver isn't serialisable. Only one of each is in flight
 * at a time, which matches how these are used.
 */
import { defineStore } from 'pinia'

let _id = 0
let _confirmResolve = null
let _promptResolve = null

export const useDialogStore = defineStore('dialog', {
  state: () => ({
    toasts: [], // { id, message, type }
    confirmOpts: null, // { title, message, confirmText, cancelText, danger }
    promptOpts: null // { title, label, value, placeholder, confirmText }
  }),

  actions: {
    /** Transient notification. type: 'info' | 'success' | 'error' | 'warning'. */
    toast(message, type = 'info', timeout = 3800) {
      const id = ++_id
      this.toasts.push({ id, message, type })
      if (timeout) setTimeout(() => this.dismiss(id), timeout)
      return id
    },
    dismiss(id) {
      this.toasts = this.toasts.filter((t) => t.id !== id)
    },

    /** Yes/no dialog → resolves to true (confirmed) or false (cancelled). */
    confirm(opts = {}) {
      this.confirmOpts = { confirmText: '', cancelText: '', danger: false, title: '', message: '', ...opts }
      return new Promise((resolve) => { _confirmResolve = resolve })
    },
    _settleConfirm(value) {
      this.confirmOpts = null
      if (_confirmResolve) { _confirmResolve(value); _confirmResolve = null }
    },

    /** Single-line text input → resolves to the string, or null if cancelled. */
    promptText(opts = {}) {
      this.promptOpts = { value: '', confirmText: '', title: '', label: '', placeholder: '', ...opts }
      return new Promise((resolve) => { _promptResolve = resolve })
    },
    _settlePrompt(value) {
      this.promptOpts = null
      if (_promptResolve) { _promptResolve(value); _promptResolve = null }
    }
  }
})
