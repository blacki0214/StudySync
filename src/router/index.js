/**
 * router/index.js
 * ----------------------------------------------------------------------------
 * Vue Router configuration. Routes are lazy-loaded so each view is split into
 * its own chunk. A global guard restores the auth session once and protects
 * pages that require login.
 */

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/authStore.js'

const routes = [
  { path: '/', name: 'landing', component: () => import('../views/LandingView.vue'), meta: { public: true, layout: 'blank' } },
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { public: true, layout: 'blank' } },
  { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue'), meta: { public: true, layout: 'blank' } },

  { path: '/dashboard', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
  { path: '/subjects', name: 'subjects', component: () => import('../views/SubjectsView.vue') },
  { path: '/notes', name: 'notes', component: () => import('../views/NotesView.vue') },
  { path: '/notes/:id', name: 'note-detail', component: () => import('../views/NoteDetailView.vue'), props: true },
  { path: '/rooms/:id', name: 'study-room', component: () => import('../views/StudyRoomView.vue'), props: true },
  { path: '/flashcards', name: 'flashcards', component: () => import('../views/FlashcardsView.vue') },
  { path: '/flashcards/:noteId', name: 'flashcards-note', component: () => import('../views/FlashcardsView.vue'), props: true },
  { path: '/community', name: 'community', component: () => import('../views/CommunityView.vue') },
  { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },

  { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

// Global guard: ensure the session is loaded, then enforce auth on private routes.
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.initialised) await auth.init()

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  // Prevent logged-in users from seeing login/register.
  if ((to.name === 'login' || to.name === 'register') && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }
  return true
})

export default router
