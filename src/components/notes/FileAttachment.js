/**
 * FileAttachment — an inline node for a file attached from the user's device.
 *
 * Instead of dumping a raw <a href="data:…(huge base64)…"> into the document
 * (ugly + unreadable), the file is stored on the node (href + name + mime + size)
 * and rendered by FileAttachmentView as a compact chip: a file-type icon (or a
 * small thumbnail for images) plus the name and size. The href lives in an
 * attribute, so the giant data-URL fallback never shows up as visible text.
 *
 * renderHTML emits a normal <a data-file-attachment …> whose visible text is the
 * file name, so saved HTML / PDF / Word degrade gracefully to a named link.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import FileAttachmentView from './FileAttachmentView.vue'

export const FileAttachment = Node.create({
  name: 'fileAttachment',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      href: { default: '' },
      name: { default: 'file' },
      mime: { default: '' },
      size: { default: 0 }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-file-attachment]',
        getAttrs: (el) => ({
          href: el.getAttribute('href') || '',
          name: el.getAttribute('data-name') || el.textContent || 'file',
          mime: el.getAttribute('data-mime') || '',
          size: Number(el.getAttribute('data-size')) || 0
        })
      }
    ]
  },

  renderHTML({ node }) {
    const { href, name, mime, size } = node.attrs
    return [
      'a',
      mergeAttributes({
        'data-file-attachment': 'true',
        href,
        'data-name': name,
        'data-mime': mime,
        'data-size': String(size || 0),
        target: '_blank',
        rel: 'noopener'
      }),
      name
    ]
  },

  addNodeView() {
    return VueNodeViewRenderer(FileAttachmentView)
  }
})
