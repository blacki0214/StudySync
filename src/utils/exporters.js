/**
 * exporters.js
 * ----------------------------------------------------------------------------
 * Client-side exporters for generated study material — Markdown, CSV and an
 * Anki-friendly tab-separated file — plus full-note export to PDF and Word
 * (.docx). Pure browser JS (Blob download / print), no backend, so everything
 * works identically in demo and live mode. The DOCX library is loaded lazily so
 * it never weighs down the initial bundle.
 */

function download(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
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

/* ---------------------------------------------------------------------------
 * Full-note export (PDF + Word)
 * The note editor (Tiptap) hands us self-contained HTML: images carry their
 * float/width inline, code blocks are <pre><code>. We only need to supply the
 * surrounding document typography so the output reads like the on-screen page.
 * ------------------------------------------------------------------------- */

const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Document typography shared by the PDF print sheet — kept close to editor.css
// so the export looks like the note, not a raw HTML dump.
const NOTE_PRINT_CSS = `
  * { box-sizing: border-box; }
  body { font-family: Inter, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
         color: #1e293b; line-height: 1.7; margin: 0; padding: 0;
         font-size: 15px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc-title { font-size: 1.9rem; font-weight: 800; margin: 0 0 4px; }
  .doc-meta { color: #64748b; font-size: 0.85rem; margin: 0 0 28px; }
  h1 { font-size: 1.7rem; margin: 1.2rem 0 0.4rem; }
  h2 { font-size: 1.3rem; margin: 1.1rem 0 0.4rem; }
  h3 { font-size: 1.1rem; margin: 1rem 0 0.3rem; }
  p { margin: 0 0 0.7rem; }
  ul, ol { padding-left: 1.4rem; line-height: 1.8; }
  ul[data-type="taskList"] { list-style: none; padding-left: 0.2rem; }
  ul[data-type="taskList"] li { display: flex; gap: 0.5rem; align-items: flex-start; }
  a { color: #4f46e5; }
  mark { background: #fef08a; padding: 0 2px; border-radius: 3px; }
  blockquote { border-left: 3px solid #cbd5e1; margin: 0.6rem 0; padding: 0.1rem 0 0.1rem 1rem; color: #475569; }
  code { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 1px 5px; font-size: 0.9em;
         font-family: "Courier New", monospace; }
  pre { background: #1e1e2e; color: #d4d4d4; border-radius: 8px; padding: 16px 18px; overflow-x: auto;
        font-family: "Courier New", monospace; font-size: 0.85rem; line-height: 1.55; white-space: pre-wrap;
        word-break: break-word; }
  pre code { background: none; border: none; padding: 0; color: inherit; }
  img { max-width: 100%; border-radius: 6px; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.4rem 0; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #cbd5e1; padding: 6px 10px; }
  @page { margin: 18mm; }
`

/**
 * Note → PDF, via the browser's print pipeline (user picks "Save as PDF").
 * No dependency, and it honours the document CSS so fidelity is high. We render
 * into a hidden iframe — more reliable than window.open under popup blockers —
 * and wait for images to load before printing so nothing is cut off.
 */
export function exportNotePdf({ title = 'Note', subtitle = '', html = '' }) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument
    doc.open()
    doc.write(`<!doctype html><html><head><meta charset="utf-8">
      <title>${escapeHtml(title)}</title><style>${NOTE_PRINT_CSS}</style></head>
      <body>
        <h1 class="doc-title">${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="doc-meta">${escapeHtml(subtitle)}</p>` : ''}
        <div class="doc-body">${html}</div>
      </body></html>`)
    doc.close()

    const cleanup = () => { iframe.remove(); resolve() }
    const print = () => {
      const win = iframe.contentWindow
      win.focus()
      win.print()
      // The print dialog is modal; give it a beat, then tear the iframe down.
      setTimeout(cleanup, 1000)
    }

    // Wait for fonts + images so the PDF isn't paginated before they paint.
    const imgs = Array.from(doc.images || [])
    let pending = imgs.length
    if (!pending) { setTimeout(print, 50); return }
    const tick = () => { if (--pending <= 0) print() }
    imgs.forEach((img) => {
      if (img.complete) tick()
      else { img.addEventListener('load', tick); img.addEventListener('error', tick) }
    })
    // Safety net: never hang if an image stalls.
    setTimeout(() => { if (pending > 0) { pending = 0; print() } }, 4000)
  })
}

/**
 * Note → Word (.docx), via @turbodocx/html-to-docx (browser-friendly fork of
 * html-to-docx, same API). Loaded lazily so the ~kb-heavy DOCX builder only
 * ships when someone actually exports. Returns once the file has downloaded.
 */
export async function exportNoteDocx({ title = 'Note', subtitle = '', html = '' }) {
  const { default: HTMLtoDOCX } = await import('@turbodocx/html-to-docx')
  const body = `
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<p style="color:#64748b;font-size:11px;">${escapeHtml(subtitle)}</p>` : ''}
    ${html}`
  const file = await HTMLtoDOCX(body, null, {
    title,
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
    table: { row: { cantSplit: true } }
  })
  // In the browser the lib resolves to a Blob; normalise just in case.
  const blob = file instanceof Blob ? file : new Blob([file], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  })
  download(`${slug(title)}.docx`, blob)
}
