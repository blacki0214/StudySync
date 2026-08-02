/**
 * sampleRooms.js
 * ----------------------------------------------------------------------------
 * Study rooms list + the live room detail (participants, activity, shared
 * resources, chat) shown in the video-call mockup. Video is a visual mock:
 * tiles show avatars/portraits, mute states and an active speaker.
 */

export const sampleRooms = [
  {
    id: 'room-1',
    code: 'COS30049 · Group 4',
    name: 'Blockchain Final Prep · Friday Crunch',
    subject_id: 'sub-1',
    description: 'Working chapter 6 problems before the final.',
    live: true,
    active_users: 6
  },
  {
    id: 'room-2',
    code: 'COS30043 · Group 2',
    name: 'Vue Project Standup',
    subject_id: 'sub-2',
    description: 'Component architecture and state management.',
    live: true,
    active_users: 4
  },
  {
    id: 'room-3',
    code: 'INF10025 · Open',
    name: 'Database Design Clinic',
    subject_id: 'sub-3',
    description: 'Drop-in help on normalisation and ER diagrams.',
    live: false,
    active_users: 2
  }
]

// Participants for the active room. `speaking` highlights the active speaker.
export const roomParticipants = [
  { id: 'user-2', name: 'Linh Trần', portrait: 'https://i.pravatar.cc/300?img=47', cameraOn: true, muted: false, speaking: true },
  { id: 'user-3', name: 'Tuấn Phạm', portrait: 'https://i.pravatar.cc/150?img=33', cameraOn: false, muted: false },
  { id: 'user-1', name: 'Minh Nguyễn (you)', portrait: 'https://i.pravatar.cc/300?img=68', cameraOn: true, muted: false },
  { id: 'user-4', name: 'Hà Vũ', portrait: 'https://i.pravatar.cc/150?img=45', cameraOn: false, muted: true },
  { id: 'user-6', name: 'Bảo Lê', portrait: 'https://i.pravatar.cc/300?img=32', cameraOn: true, muted: false },
  { id: 'user-7', name: 'Quỳnh Anh', portrait: 'https://i.pravatar.cc/150?img=49', cameraOn: false, muted: true }
]

export const roomActivity = [
  { text: "Linh pinned 'Lecture 6 slides'", ago: '2m', color: '#10b981' },
  { text: 'Tuấn added a resource', ago: '5m', color: '#6366f1' },
  { text: 'Hà joined the room', ago: '8m', color: '#f59e0b' },
  { text: 'Pomodoro session #2 started', ago: '12m', color: '#10b981' }
]

export const roomResources = [
  { name: 'Lecture 6 slides.pdf', size: '4.2 MB', icon: 'bi-file-earmark-slides' },
  { name: 'Answer key set 5.pdf', size: '1.1 MB', icon: 'bi-file-earmark-text' },
  { name: 'Merkle tree examples.png', size: '320 KB', icon: 'bi-file-earmark-image' }
]

export const roomChat = [
  { id: 'user-2', name: 'Linh', time: '19:32', text: "Let's start with chapter 6 problems first", me: false },
  { id: 'user-3', name: 'Tuấn', time: '19:33', text: 'Sent the answer key in resources 📎', me: false },
  { id: 'user-4', name: 'Hà', time: '19:35', text: 'Question 3, anyone got a clean proof?', me: false },
  { id: 'user-1', name: 'Minh', time: '19:35', text: "I'll share my screen", me: true },
  { id: 'user-6', name: 'Bảo', time: '19:36', text: 'Coffee break in 10 ☕', me: false }
]
