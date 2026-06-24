/**
 * dataImport.js
 * ----------------------------------------------------------------------------
 * Turn an uploaded data file into rows the note editor can drop in as a table.
 *   • .csv / .tsv / .txt  → parsed in-browser, zero dependency
 *   • .xlsx / .xls        → parsed with SheetJS, loaded lazily so the (~hundreds
 *                            of kB) library only ships when someone imports Excel
 * The result is a 2-D array of strings (first row treated as the header), which
 * `rowsToTableHtml` renders to <table> HTML — Tiptap parses that into a real,
 * editable table node, exactly as if it had been pasted from a spreadsheet.
 */

// Guard rails: a note table is for reference, not a full dataset. Beyond these
// the editor (ProseMirror) gets sluggish, so we truncate and tell the caller.
export const MAX_ROWS = 500
export const MAX_COLS = 50

const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Parse delimited text (CSV/TSV) into rows, honouring RFC-4180 quoting:
 * double-quoted fields may contain the delimiter, newlines and escaped quotes
 * ("").  A single pass over the characters keeps it correct where naive
 * line/comma splitting would break on quoted commas or multi-line cells.
 */
export function parseDelimitedText(text, delimiter = ',') {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  // Normalise newlines so \r\n and \r behave like \n.
  const s = text.replace(/\r\n?/g, '\n')

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ } // escaped quote
        else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === delimiter) {
      row.push(field); field = ''
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = ''
    } else {
      field += c
    }
  }
  // Flush the trailing field/row (file may not end in a newline).
  if (field.length || row.length) { row.push(field); rows.push(row) }

  // Drop fully-blank trailing rows.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

// Pick the delimiter for a .csv/.txt file by seeing which separator yields more
// columns on the first non-empty line (handles comma, semicolon and tab files).
function detectDelimiter(text) {
  const firstLine = text.replace(/\r\n?/g, '\n').split('\n').find((l) => l.trim() !== '') || ''
  const counts = { ',': 0, ';': 0, '\t': 0 }
  let inQuotes = false
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes && ch in counts) counts[ch]++
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ','
}

/**
 * Read any supported data file into a 2-D array of strings.
 * Returns { rows, truncated, sheetName }. Throws on an unsupported extension or
 * an empty file so the caller can surface a friendly message.
 */
export async function readDataFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  let rows
  let sheetName = ''

  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    sheetName = wb.SheetNames[0]
    const sheet = wb.Sheets[sheetName]
    if (!sheet) throw new Error('empty-workbook')
    // header:1 → array-of-arrays; defval keeps empty cells aligned.
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' })
      .map((r) => r.map((c) => (c == null ? '' : String(c))))
  } else if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
    const text = await file.text()
    const delimiter = ext === 'tsv' ? '\t' : detectDelimiter(text)
    rows = parseDelimitedText(text, delimiter)
  } else {
    throw new Error('unsupported-type')
  }

  rows = rows.filter((r) => r.length)
  if (!rows.length) throw new Error('no-rows')

  // Normalise to a rectangle (every row the width of the widest row).
  const width = Math.min(MAX_COLS, rows.reduce((m, r) => Math.max(m, r.length), 0))
  let truncated = width < rows.reduce((m, r) => Math.max(m, r.length), 0)
  if (rows.length > MAX_ROWS) { rows = rows.slice(0, MAX_ROWS); truncated = true }
  rows = rows.map((r) => {
    const out = r.slice(0, width)
    while (out.length < width) out.push('')
    return out
  })

  return { rows, truncated, sheetName }
}

/** Render rows to <table> HTML — first row as <th> header, the rest as <td>. */
export function rowsToTableHtml(rows, { headerRow = true } = {}) {
  if (!rows.length) return ''
  const cell = (tag, v) => `<${tag}>${escapeHtml(v) || '&nbsp;'}</${tag}>`
  const head = headerRow
    ? `<tr>${rows[0].map((v) => cell('th', v)).join('')}</tr>`
    : ''
  const bodyRows = (headerRow ? rows.slice(1) : rows)
    .map((r) => `<tr>${r.map((v) => cell('td', v)).join('')}</tr>`)
    .join('')
  return `<table>${head}${bodyRows}</table>`
}
