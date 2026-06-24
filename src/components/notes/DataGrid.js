/**
 * DataGrid — a custom Tiptap node for *imported* tabular data (CSV / Excel).
 *
 * Unlike the editable `table` node, a data grid is a single atom that holds the
 * whole dataset and renders a Jira-style paged viewer (see DataGridView.vue):
 * the editor shows the first page only, with pager controls, so a 10k-row import
 * never bogs the document down. The full dataset still round-trips and exports —
 * renderHTML() emits a complete <table> (every row), and parseHTML() reads it
 * back, so saving (editor.getHTML()), PDF and Word all contain all the data.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import DataGridView from './DataGridView.vue'

export const DataGrid = Node.create({
  name: 'dataGrid',
  group: 'block',
  atom: true, // a single, non-text-editable unit
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      // 2-D array of strings, header row included as rows[0] when headerRow.
      rows: { default: [], rendered: false },
      headerRow: { default: true, rendered: false },
      pageSize: { default: 10, rendered: false },
      // Optional caption (e.g. the source file name).
      caption: { default: '', rendered: false }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'table[data-data-grid]',
        getAttrs: (el) => {
          const trs = Array.from(el.querySelectorAll('tr'))
          const rows = trs.map((tr) =>
            Array.from(tr.children).map((cell) => cell.textContent ?? '')
          )
          return {
            rows,
            headerRow: !!el.querySelector('th'),
            pageSize: Number(el.getAttribute('data-page-size')) || 10,
            caption: el.getAttribute('data-caption') || ''
          }
        }
      }
    ]
  },

  // Serialise the FULL dataset as a real table so saved HTML / PDF / Word keep
  // every row. The node view (DataGridView) is what paginates on screen.
  renderHTML({ node }) {
    const { rows, headerRow, pageSize, caption } = node.attrs
    const body = (rows || []).map((row, r) => {
      const tag = headerRow && r === 0 ? 'th' : 'td'
      return ['tr', {}, ...row.map((cell) => [tag, {}, String(cell ?? '')])]
    })
    return [
      'table',
      mergeAttributes({
        'data-data-grid': 'true',
        'data-page-size': String(pageSize || 10),
        ...(caption ? { 'data-caption': caption } : {})
      }),
      ['tbody', {}, ...body]
    ]
  },

  addNodeView() {
    return VueNodeViewRenderer(DataGridView)
  }
})
