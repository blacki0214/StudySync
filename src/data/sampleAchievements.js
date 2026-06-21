/**
 * sampleAchievements.js
 * ----------------------------------------------------------------------------
 * Profile page: 12-month reputation series + unlocked/locked achievements.
 */

export const reputationSeries = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  values: [180, 320, 470, 520, 700, 980, 1120, 1180, 1420, 1560, 1720, 1840],
  max: 2200,
  ytd: 1840
}

export const achievements = [
  { id: 'a1', name: '14-day streak', desc: 'Studied every day for 2 weeks', icon: 'bi-fire', color: 'grad-orange', unlocked: true },
  { id: 'a2', name: 'Note Maven', desc: '47 notes shared with community', icon: 'bi-file-earmark-text', color: 'grad-blue', unlocked: true },
  { id: 'a3', name: 'Top 4% Vietnam', desc: 'Among the top contributors', icon: 'bi-trophy', color: 'grad-orange', unlocked: true },
  { id: 'a4', name: 'Quiz Master', desc: 'Aced 25 quizzes in a row', icon: 'bi-stars', color: 'grad-fuchsia', unlocked: true },
  { id: 'a5', name: 'Collaborator', desc: 'Co-edited 30 live notes', icon: 'bi-people', color: 'grad-green', unlocked: true },
  { id: 'a6', name: 'Early Bird', desc: '20 sessions before 8am', icon: 'bi-sunrise', color: 'grad-blue', unlocked: true },
  { id: 'a7', name: 'Polyglot', desc: 'Notes in 3 languages', icon: 'bi-translate', color: 'grad-fuchsia', unlocked: false },
  { id: 'a8', name: 'Marathoner', desc: '100-day study streak', icon: 'bi-lightning', color: 'grad-orange', unlocked: false }
]
