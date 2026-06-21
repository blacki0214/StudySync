/**
 * sampleDashboard.js
 * ----------------------------------------------------------------------------
 * Demo content for the dashboard: weekly focus-time series, upcoming study
 * sessions and the weekly leaderboard — all matching the Figma mockup.
 */

// Weekly focus-time area chart (hours per day, Mon→Sun).
export const weeklyFocus = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  values: [2.1, 3.0, 2.4, 3.6, 2.8, 3.9, 4.2],
  max: 8
}

// Upcoming study sessions shown on the right rail.
export const upcomingSessions = [
  { id: 's1', title: 'Algorithms revision', when: 'Today, 19:30', joining: 6, color: '#6366f1', avatars: ['user-2', 'user-3', 'user-4'] },
  { id: 's2', title: 'Database group project', when: 'Tomorrow, 14:00', joining: 4, color: '#8b5cf6', avatars: ['user-3', 'user-5', 'user-6'] },
  { id: 's3', title: 'Calc III problem set', when: 'Wed, 20:00', joining: 8, color: '#10b981', avatars: ['user-4', 'user-2', 'user-5'] }
]

// Weekly contributor leaderboard.
export const weeklyLeaderboard = [
  { id: 'user-2', full_name: 'Linh Trần', points: 1240 },
  { id: 'user-3', full_name: 'Tuấn Phạm', points: 980 },
  { id: 'user-1', full_name: 'Minh Nguyễn', points: 860 },
  { id: 'user-4', full_name: 'Hà Vũ', points: 710 },
  { id: 'user-5', full_name: 'Bảo Lê', points: 560 }
]
