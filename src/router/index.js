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
  // The marketing landing page is removed — go straight to the app (the guard
  // sends logged-out visitors to /login and logged-in users to the hub).
  { path: '/', redirect: '/hub' },
  { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { public: true, layout: 'blank' } },
  { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue'), meta: { public: true, layout: 'blank' } },
  { path: '/forgot-password', name: 'forgot-password', component: () => import('../views/ForgotPasswordView.vue'), meta: { public: true, layout: 'blank' } },
  { path: '/reset-password', name: 'reset-password', component: () => import('../views/ResetPasswordView.vue'), meta: { public: true, layout: 'blank' } },
  { path: '/welcome', name: 'welcome', component: () => import('../views/WelcomeView.vue'), meta: { public: true, layout: 'blank' } },

  // The Hub is the home command-center (formerly the dashboard).
  { path: '/hub', name: 'hub', component: () => import('../views/HubView.vue') },
  { path: '/dashboard', redirect: '/hub' }, // backwards-compatible redirect
  { path: '/subjects', name: 'subjects', component: () => import('../views/SubjectsView.vue') },
  { path: '/my-subjects', name: 'my-subjects', component: () => import('../views/MySubjectsView.vue') },
  { path: '/subjects/:id', name: 'subject-hub', component: () => import('../views/SubjectHubView.vue'), props: true },
  { path: '/subjects/:id/workspace', name: 'subject-workspace', component: () => import('../views/SubjectWorkspaceView.vue'), props: true },
  { path: '/notes', name: 'notes', component: () => import('../views/NotesView.vue') },
  { path: '/tasks', name: 'tasks', component: () => import('../views/TasksView.vue') },
  { path: '/schedule', name: 'schedule', component: () => import('../views/ScheduleView.vue') },
  { path: '/notes/:id', name: 'note-detail', component: () => import('../views/NoteDetailView.vue'), props: true },
  // Shareable note link — opens inside the app; visitors must log in (the guard
  // redirects to /login?redirect=/share/:id), then edit/view per the link's permission.
  { path: '/share/:id', name: 'note-share', component: () => import('../views/NoteDetailView.vue'), props: true },
  { path: '/rooms', name: 'rooms', component: () => import('../views/StudyRoomsView.vue') },
  { path: '/rooms/:id', name: 'study-room', component: () => import('../views/StudyRoomView.vue'), props: true },
  { path: '/flashcards', name: 'flashcards', component: () => import('../views/FlashcardsView.vue') },
  { path: '/flashcards/:noteId', name: 'flashcards-note', component: () => import('../views/FlashcardsView.vue'), props: true },
  { path: '/community', name: 'community', component: () => import('../views/CommunityView.vue') },
  { path: '/classes', name: 'classes', component: () => import('../views/ClassesView.vue') },
  { path: '/classes/:id', name: 'class-detail', component: () => import('../views/ClassDetailView.vue'), props: true },
  { path: '/join', name: 'join-class', component: () => import('../views/JoinClassView.vue') },
  { path: '/profile', name: 'profile', component: () => import('../views/ProfileView.vue') },

  { path: '/:pathMatch(.*)*', redirect: '/hub' }
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
    return { name: 'hub' }
  }
  // Role-gated routes (e.g. teacher-only Classes area). Bounce to the hub.
  if (to.meta.requireRole && auth.role !== to.meta.requireRole) {
    return { name: 'hub' }
  }
  return true
})

export default router
