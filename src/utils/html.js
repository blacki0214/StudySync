/**
 * html.js — tiny helper to turn rich-text HTML (stored note content) back into
 * plain text for the rule-based study tools, previews and difficulty analysis.
 */
export function htmlToText(html) {
  if (!html) return ''
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const div = document.createElement('div')
  div.innerHTML = html
  // Turn block boundaries into spaces so sentences don't run together.
  div.querySelectorAll('p,div,h1,h2,h3,li,br,blockquote,pre').forEach((el) => el.append(' '))
  return (div.textContent || '').replace(/\s+/g, ' ').trim()
}

/**
 * Like htmlToText, but keeps block boundaries as line breaks so the version
 * diff can preserve the document's paragraph/heading layout instead of
 * collapsing everything onto one line.
 */
export function htmlToBlockText(html) {
  if (!html) return ''
  if (typeof document === 'undefined') {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h1|h2|h3|h4|li|blockquote|pre)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
  const div = document.createElement('div')
  div.innerHTML = html
  div.querySelectorAll('br').forEach((el) => el.replaceWith('\n'))
  div.querySelectorAll('p,div,h1,h2,h3,h4,li,blockquote,pre').forEach((el) => el.append('\n'))
  return (div.textContent || '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
