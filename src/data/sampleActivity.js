/**
 * sampleActivity.js
 * ----------------------------------------------------------------------------
 * A single ordered, cross-feature activity stream for the Hub. Each event is
 * typed and carries an i18n `key` + `params` (so the feed translates) and a
 * `to` route target (so each row links into the relevant feature). Seeded from
 * the existing demo entities (notes, rooms, community posts, decks).
 */
export const activityFeed = [
  {
    id: 'act-1',
    type: 'note',
    icon: 'bi-file-earmark-text',
    color: '#6366f1',
    actorId: 'user-2',
    ago: '2m',
    key: 'hub.activity.noteEdited',
    params: { title: 'Consensus Mechanisms' },
    to: { name: 'note-detail', params: { id: 'note-1' } }
  },
  {
    id: 'act-2',
    type: 'room',
    icon: 'bi-people-fill',
    color: '#10b981',
    actorId: 'user-3',
    ago: '6m',
    key: 'hub.activity.roomShared',
    params: { room: 'Blockchain Final Prep' },
    to: { name: 'study-room', params: { id: 'room-1' } }
  },
  {
    id: 'act-3',
    type: 'community',
    icon: 'bi-chat-square-text',
    color: '#d946ef',
    actorId: 'user-4',
    ago: '18m',
    key: 'hub.activity.communityAnswered',
    params: { title: "Ethereum's PBS architecture" },
    to: { name: 'community' }
  },
  {
    id: 'act-4',
    type: 'flashcards',
    icon: 'bi-stars',
    color: '#f59e0b',
    actorId: 'user-1',
    ago: '40m',
    key: 'hub.activity.deckMastered',
    params: { n: 12, deck: 'Blockchain Consensus' },
    to: { name: 'flashcards' }
  },
  {
    id: 'act-5',
    type: 'note',
    icon: 'bi-file-earmark-text',
    color: '#6366f1',
    actorId: 'user-1',
    ago: '1h',
    key: 'hub.activity.noteCreated',
    params: { title: 'Vue Reactivity & Composition API' },
    to: { name: 'note-detail', params: { id: 'note-3' } }
  }
]
