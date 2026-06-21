/**
 * sampleEditor.js
 * ----------------------------------------------------------------------------
 * Collaborator presence, comments and version history shown in the Collab Notes
 * editor's right panel (Online / Comments / History tabs).
 */

export const editorCollaborators = [
  { id: 'user-2', name: 'Linh Trần', avatar: 'https://i.pravatar.cc/150?img=47', status: 'editing §2', ring: '#10b981', dot: '#10b981' },
  { id: 'user-3', name: 'Tuấn Phạm', avatar: 'https://i.pravatar.cc/150?img=33', status: 'viewing', ring: '#6366f1', dot: '#10b981' },
  { id: 'user-4', name: 'Hà Vũ', avatar: 'https://i.pravatar.cc/150?img=45', status: 'adding examples', ring: '#f59e0b', dot: '#10b981' },
  { id: 'user-5', name: 'Bảo Lê', avatar: '', status: 'idle', ring: '#f59e0b', dot: '#94a3b8', initials: 'B' }
]

export const editorComments = [
  { id: 'cm1', author: 'Tuấn Phạm', avatar: 'https://i.pravatar.cc/150?img=33', ago: '4m', text: 'Should we add the energy comparison chart here?', resolved: false },
  { id: 'cm2', author: 'Hà Vũ', avatar: 'https://i.pravatar.cc/150?img=45', ago: '11m', text: 'Linked the Ethereum Merge source in §3.', resolved: true }
]

export const editorHistory = [
  { id: 'h1', version: 6, author: 'Linh Trần', ago: 'just now', summary: 'Added Byzantine actors note' },
  { id: 'h2', version: 5, author: 'Tuấn Phạm', ago: '18m', summary: 'Highlighted energy use callout' },
  { id: 'h3', version: 4, author: 'Minh Nguyễn', ago: '1h', summary: 'Restructured PoW section' },
  { id: 'h4', version: 3, author: 'Hà Vũ', ago: '3h', summary: 'Added PoS validators list' }
]
