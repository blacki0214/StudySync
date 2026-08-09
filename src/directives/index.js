/**
 * directives/index.js
 * ----------------------------------------------------------------------------
 * The app's custom Vue directives, registered once in main.js so every component
 * can use them without importing anything.
 *
 * A directive — not a component — is the right tool when the job is *behaviour
 * attached to an element that already exists*: moving focus into it, noticing
 * clicks that land outside it, or rewriting its text to mark up search hits.
 * Wrapping any of those in a component would mean adding a wrapper element to
 * the DOM purely to host the behaviour, and would force every call site to
 * restructure its markup. A directive leaves the markup alone.
 *
 * Each one below uses a different part of the directive lifecycle, which is the
 * point: `mounted` for one-shot DOM work, `mounted` + `unmounted` for anything
 * that registers a listener, and `mounted` + `updated` for behaviour that has to
 * track a reactive value.
 */

// ---------------------------------------------------------------------------
// v-focus
// ---------------------------------------------------------------------------

/**
 * Put the caret in this element as soon as it renders.
 *
 *   <input v-focus />                  focus on mount
 *   <input v-focus="isEditing" />      focus only when the value is truthy
 *   <input v-focus.select />           focus AND select the existing text
 *
 * The call is deferred by one frame because `mounted` fires while the element
 * may still be inside an entering <transition> — an element that is not yet
 * laid out cannot take focus, and the call would silently do nothing.
 */
export const vFocus = {
  mounted(el, binding) {
    if (binding.value === false) return
    requestAnimationFrame(() => {
      el.focus()
      if (binding.modifiers.select && typeof el.select === 'function') el.select()
    })
  }
}

// ---------------------------------------------------------------------------
// v-click-outside
// ---------------------------------------------------------------------------

/**
 * Run a handler when a pointer press lands outside this element — the dismiss
 * behaviour every dropdown, popover and dialog needs.
 *
 *   <div v-click-outside="close">
 *   <div v-click-outside.esc="close">   also close on the Escape key
 *
 * Two deliberate choices:
 *   • `pointerdown`, not `click` — the menu closes on press rather than waiting
 *     for release, which is what makes it feel native.
 *   • capture phase (`true`) — a handler *inside* the menu that calls
 *     stopPropagation() cannot swallow the outside-click check.
 *
 * `unmounted` is not optional here. A directive that attaches a document
 * listener and never removes it leaks one listener per element per navigation,
 * and the stale closure keeps the whole component tree alive.
 */
export const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (e) => {
      if (!el.contains(e.target) && typeof binding.value === 'function') binding.value(e)
    }
    document.addEventListener('pointerdown', el._clickOutside, true)

    if (binding.modifiers.esc) {
      el._escOutside = (e) => {
        if (e.key === 'Escape' && typeof binding.value === 'function') binding.value(e)
      }
      document.addEventListener('keydown', el._escOutside)
    }
  },
  unmounted(el) {
    document.removeEventListener('pointerdown', el._clickOutside, true)
    if (el._escOutside) document.removeEventListener('keydown', el._escOutside)
    delete el._clickOutside
    delete el._escOutside
  }
}

// ---------------------------------------------------------------------------
// v-highlight
// ---------------------------------------------------------------------------

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c])
const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Wrap every occurrence of a search term in this element's text with <mark>, so
 * a filtered list shows *why* each row matched instead of leaving the user to
 * re-scan it themselves.
 *
 *   <div class="note-title" v-highlight="search">{{ note.title }}</div>
 *
 * Use it on an element whose only child is text — it owns that element's
 * innerHTML.
 *
 * Three things worth knowing about the implementation:
 *
 * 1. It implements BOTH `mounted` and `updated`. The term is reactive, so the
 *    element has to be re-marked whenever the query changes, not just once.
 *
 * 2. It never caches the original text, and doesn't need to: <mark> is an
 *    element, so inserting it does not change `el.textContent`. Reading
 *    textContent therefore always returns the clean source string whether or
 *    not this directive has already run — which also means repeated runs can't
 *    compound into nested <mark> tags. (Vue patches an element's text child
 *    before calling `updated`, so a row whose title changed is already showing
 *    its new text by the time we read it.)
 *
 * 3. Both the text and the term are escaped before either reaches innerHTML.
 *    The term is typed by the user, so treating it as HTML would be an XSS hole
 *    and treating it as a regex would let a stray `(` throw. The term is
 *    HTML-escaped first and regex-escaped second, so it still matches the
 *    already-escaped source.
 */
function applyHighlight(el, binding) {
  const term = String(binding.value ?? '').trim()
  const source = el.textContent

  if (!term) {
    // Clearing the search must strip any marks left from the previous term.
    if (el.querySelector('mark')) el.textContent = source
    return
  }

  const needle = escapeRegExp(escapeHtml(term))
  el.innerHTML = escapeHtml(source).replace(new RegExp(`(${needle})`, 'gi'), '<mark class="hl">$1</mark>')
}

export const vHighlight = {
  mounted: applyHighlight,
  updated: applyHighlight
}

// ---------------------------------------------------------------------------

/** Install every directive on the app instance. Called once from main.js. */
export function registerDirectives(app) {
  app.directive('focus', vFocus)
  app.directive('click-outside', vClickOutside)
  app.directive('highlight', vHighlight)
}
