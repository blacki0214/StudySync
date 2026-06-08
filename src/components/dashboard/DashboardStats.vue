<script setup>
/** DashboardStats — the four headline stat cards. */
defineProps({
  stats: { type: Array, default: () => [] } // [{ icon, value, label, grad }]
})
</script>

<template>
  <div class="row g-3">
    <div v-for="s in stats" :key="s.label" class="col-6 col-lg-3">
      <div class="stat-card">
        <span class="stat-icon" :class="s.grad"><i class="bi" :class="s.icon"></i></span>
        <div>
          <div class="stat-value">{{ s.value }}</div>
          <div class="stat-label">{{ s.label }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
