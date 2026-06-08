<script setup>
/**
 * AppNavbar — top bar with search, demo-mode badge and the user menu.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/authStore.js'
import { isSupabaseConfigured } from '../../services/supabaseClient.js'

defineEmits(['toggle-sidebar'])

const auth = useAuthStore()
const router = useRouter()
const search = ref('')

// First initials for the avatar circle.
function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function onSearch() {
  if (search.value.trim()) {
    router.push({ name: 'notes', query: { q: search.value.trim() } })
  }
}

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="app-navbar">
    <div class="d-flex align-items-center gap-3">
      <button class="navbar-toggle" aria-label="Toggle menu" @click="$emit('toggle-sidebar')">
        <i class="bi bi-list"></i>
      </button>
      <div class="navbar-search">
        <i class="bi bi-search"></i>
        <input
          v-model="search"
          type="search"
          placeholder="Search notes..."
          @keyup.enter="onSearch"
        />
      </div>
    </div>

    <div class="navbar-actions">
      <span v-if="!isSupabaseConfigured" class="demo-badge" title="Supabase not configured">
        DEMO MODE
      </span>

      <div class="dropdown">
        <div
          class="user-chip"
          data-bs-toggle="dropdown"
          aria-expanded="false"
          role="button"
        >
          <span class="user-avatar">{{ initials(auth.displayName) }}</span>
          <div class="d-none d-md-block">
            <div class="user-name">{{ auth.displayName }}</div>
            <div class="user-rep"><i class="bi bi-star-fill text-warning"></i> {{ auth.user?.reputation ?? 0 }} pts</div>
          </div>
          <i class="bi bi-chevron-down text-muted"></i>
        </div>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><router-link class="dropdown-item" to="/profile"><i class="bi bi-person me-2"></i>Profile</router-link></li>
          <li><hr class="dropdown-divider" /></li>
          <li><button class="dropdown-item text-danger" @click="logout"><i class="bi bi-box-arrow-right me-2"></i>Log out</button></li>
        </ul>
      </div>
    </div>
  </header>
</template>
