<script setup>
/** Leaderboard — top contributors ranked by reputation. */
defineProps({
  users: { type: Array, default: () => [] } // [{ full_name, reputation }]
})

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}
function rankClass(i) {
  return i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''
}
</script>

<template>
  <div class="panel">
    <div class="section-title"><i class="bi bi-trophy"></i>Top contributors</div>

    <div v-for="(u, i) in users" :key="u.id || i" class="leaderboard-item">
      <span class="leaderboard-rank" :class="rankClass(i)">{{ i + 1 }}</span>
      <span class="user-avatar" style="width:32px;height:32px;font-size:0.72rem">{{ initials(u.full_name) }}</span>
      <span class="lb-name">{{ u.full_name }}</span>
      <span class="lb-rep">{{ u.reputation }} pts</span>
    </div>
  </div>
</template>
