/**
 * CommentMark — a Tiptap mark that highlights commented text and carries the
 * comment's id. Because it lives in the document, it syncs via Yjs to everyone
 * and moves with edits (the highlight stays anchored to the right words). The
 * comment body/author are stored separately (note_comments) keyed by commentId.
 */
import { Mark, mergeAttributes } from '@tiptap/core'

export const CommentMark = Mark.create({
  name: 'comment',
  inclusive: false,
  excludes: '',

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-comment-id'),
        renderHTML: (attrs) => (attrs.commentId ? { 'data-comment-id': attrs.commentId } : {})
      }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'comment-mark' }), 0]
  },

  addCommands() {
    return {
      setComment:
        (commentId) =>
        ({ commands }) =>
          commands.setMark(this.name, { commentId }),
      unsetCommentById:
        (commentId) =>
        ({ tr, state, dispatch }) => {
          const { doc } = state
          const type = state.schema.marks.comment
          let changed = false
          doc.descendants((node, pos) => {
            if (!node.isText) return
            node.marks.forEach((m) => {
              if (m.type === type && m.attrs.commentId === commentId) {
                tr.removeMark(pos, pos + node.nodeSize, type)
                changed = true
              }
            })
          })
          if (changed && dispatch) dispatch(tr)
          return changed
        }
    }
  }
})
