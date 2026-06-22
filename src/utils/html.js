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
