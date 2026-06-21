/**
 * sampleUsers.js
 * ----------------------------------------------------------------------------
 * The cast of students shown across the Figma mockups. Used for collaborator
 * lists, leaderboards, community authors, study-room participants, etc.
 * `avatar` uses deterministic external portraits so the demo looks real; the
 * UI falls back to initials if an image fails to load.
 */

export const sampleUsers = [
  {
    id: 'user-1',
    full_name: 'Minh Nguyễn',
    handle: 'minhng',
    email: 'minh.nguyen@rmit.edu.vn',
    program: 'SWE · RMIT Vietnam',
    school: 'RMIT Vietnam',
    location: 'Hồ Chí Minh',
    joined: '2024-08-01',
    avatar: 'https://i.pravatar.cc/150?img=12',
    reputation: 2480,
    tier: 'Gold IV',
    percentile: 'Top 4%',
    level: 12,
    xp: 2480,
    xpNext: 3000,
    streak: 14,
    color: 'grad-blue'
  },
  { id: 'user-2', full_name: 'Linh Trần', handle: 'linhtran', program: 'RMIT · SWE', avatar: 'https://i.pravatar.cc/150?img=47', reputation: 12400, color: 'grad-fuchsia' },
  { id: 'user-3', full_name: 'Tuấn Phạm', handle: 'tuanpham', program: 'VNU · DS', avatar: 'https://i.pravatar.cc/150?img=33', reputation: 9800, color: 'grad-green' },
  { id: 'user-4', full_name: 'Hà Vũ', handle: 'havu', program: 'RMIT · IT', avatar: 'https://i.pravatar.cc/150?img=45', reputation: 7100, color: 'grad-orange' },
  { id: 'user-5', full_name: 'Bảo Lê', handle: 'baole', program: 'HCMUT · CE', avatar: 'https://i.pravatar.cc/150?img=15', reputation: 5600, color: 'grad-blue' },
  { id: 'user-6', full_name: 'Quỳnh Anh', handle: 'quynhanh', program: 'RMIT · BIS', avatar: 'https://i.pravatar.cc/150?img=49', reputation: 4200, color: 'grad-fuchsia' }
]

/** The signed-in demo user. */
export const currentUser = sampleUsers[0]

/** Quick lookup by id. */
export const userById = (id) => sampleUsers.find((u) => u.id === id) || null
