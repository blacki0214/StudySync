/**
 * ResizableImage — extends Tiptap's Image node so pictures can be edited inside
 * the document: resized (drag handle), rotated, aligned and deleted. The extra
 * attributes (width, rotate, align) are serialised into the <img> so they
 * persist in the saved HTML and render correctly outside the editor too.
 */
import Image from '@tiptap/extension-image'
import { mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import ImageNodeView from './ImageNodeView.vue'

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        // Parsing is handled here; rendering is done once in renderHTML below.
        parseHTML: (el) => {
          const w = el.style.width || el.getAttribute('width')
          return w ? parseInt(w, 10) : null
        },
        renderHTML: () => ({})
      },
      rotate: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute('data-rotate')) || 0,
        renderHTML: () => ({})
      },
      align: {
        default: 'left',
        parseHTML: (el) => el.getAttribute('data-align') || 'left',
        renderHTML: () => ({})
      }
    }
  },

  // Render a single <img> carrying width/rotate/align as inline style + data-*,
  // so a saved note shows the same thing even when rendered without the editor.
  renderHTML({ node, HTMLAttributes }) {
    const { width, rotate, align } = node.attrs
    const styles = ['display:block', 'max-width:100%']
    if (width) styles.push(`width:${width}px`)
    if (rotate) styles.push(`transform:rotate(${rotate}deg)`)
    if (align === 'center') styles.push('margin-left:auto', 'margin-right:auto')
    else if (align === 'right') styles.push('margin-left:auto')
    return ['img', mergeAttributes(HTMLAttributes, { style: styles.join(';'), 'data-align': align, 'data-rotate': rotate })]
  },

  addNodeView() {
    return VueNodeViewRenderer(ImageNodeView)
  }
})
