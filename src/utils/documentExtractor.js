/**
 * documentExtractor.js
 * ----------------------------------------------------------------------------
 * Pulls plain text out of an uploaded file, entirely in the browser (no server,
 * no external AI). PDFs are parsed with pdf.js (run in its web worker so big
 * files don't freeze the UI); .txt/.md and other text files are read directly.
 * The extracted text then feeds the existing rule-based study-tool generators.
 */

import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Point pdf.js at its bundled worker (Vite resolves ?url to a real asset URL).
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const isPdf = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name)

/**
 * Extract text + a source type from a File.
 * @returns {Promise<{ text: string, sourceType: 'pdf'|'file' }>}
 */
export async function extractFromFile(file) {
  if (isPdf(file)) return { text: await extractPdf(file), sourceType: 'pdf' }
  return { text: await file.text(), sourceType: 'file' }
}

async function extractPdf(file) {
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const parts = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    parts.push(content.items.map((i) => i.str).join(' '))
  }
  return parts.join('\n\n').replace(/[ \t]+\n/g, '\n').trim()
}

/** Accepted file extensions, for the <input accept> attribute. */
export const ACCEPTED_TYPES = '.pdf,.txt,.md,.markdown,text/plain'
