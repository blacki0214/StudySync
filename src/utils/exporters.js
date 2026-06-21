/**
 * exporters.js
 * ----------------------------------------------------------------------------
 * Client-side exporters for generated study material — Markdown, CSV and an
 * Anki-friendly tab-separated file. Pure browser JS (Blob download), no backend,
 * so it works identically in demo and live mode.
 */

function download(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
const tsvCell = (v) => String(v ?? '').replace(/\t/g, ' ').replace(/[\r\n]+/g, ' ')
const slug = (s) => (s || 'studysync').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()

/** Flashcards → CSV (Question,Answer). */
export function exportFlashcardsCsv(cards, name = 'flashcards') {
  const rows = [['Question', 'Answer'], ...cards.map((c) => [c.question, c.answer])]
  download(`${slug(name)}-flashcards.csv`, rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv')
}

/** Flashcards → Anki import format (tab-separated, no header). */
export function exportFlashcardsAnki(cards, name = 'flashcards') {
  const tsv = cards.map((c) => `${tsvCell(c.question)}\t${tsvCell(c.answer)}`).join('\n')
  download(`${slug(name)}-anki.txt`, tsv)
}

/** Full study pack (summary + flashcards + quiz) → Markdown. */
export function exportStudyMarkdown({ name = 'StudySync', summary = [], flashcards = [], quiz = [] }) {
  let md = `# ${name} — study pack\n\n`

  if (summary.length) {
    md += `## Summary\n\n${summary.map((s) => `- ${s}`).join('\n')}\n\n`
  }
  if (flashcards.length) {
    md += `## Flashcards\n\n`
    flashcards.forEach((c, i) => {
      md += `**Q${i + 1}. ${c.question}**\n\n${c.answer}\n\n`
    })
  }
  if (quiz.length) {
    md += `## Quiz\n\n`
    quiz.forEach((q, i) => {
      md += `${i + 1}. ${q.question}\n`
      q.options.forEach((o, oi) => {
        md += `   ${String.fromCharCode(97 + oi)}. ${o}${oi === q.correctAnswer ? '  ✓' : ''}\n`
      })
      md += `\n`
    })
  }

  download(`${slug(name)}-study-pack.md`, md, 'text/markdown')
}
