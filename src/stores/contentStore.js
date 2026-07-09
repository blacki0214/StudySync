/**
 * contentStore.js
 * ----------------------------------------------------------------------------
 * Single read-source for all the DISPLAY data that used to be imported straight
 * from src/data/* by the views (profiles, decks, rooms, community posts,
 * trending topics, achievements, the activity feed and the dashboard charts).
 *
 * WHY THIS EXISTS:
 *   Previously several views imported sample data directly, so even with a real
 *   Supabase backend connected they STILL showed mock content. This store funnels
 *   all of that through one gate:
 *
 *     • Supabase configured  -> fetch ONLY from the database (no sample data).
 *     • Not configured (demo) -> return the local sample data, unchanged, so the
 *       project still runs offline for marking.
 *
 * Collections are loaded once via ensureLoaded() and exposed as reactive state,
 * so any computed property referencing them updates automatically when the data
 * arrives. Lookups (userById / subjectById / subjectByCode) work in both modes.
 */

import { defineStore } from 'pinia'
import { supabase, isSupabaseConfigured } from '../services/supabaseClient.js'
import { deckService } from '../services/deckService.js'
import { communityService } from '../services/communityService.js'
import { timeAgo } from '../utils/formatDate.js'

// Sample data — only used when no backend is configured (demo mode).
import { sampleUsers } from '../data/sampleUsers.js'
import { sampleSubjects } from '../data/sampleSubjects.js'
import { sampleNotes } from '../data/sampleNotes.js'
import { sampleDecks } from '../data/sampleDecks.js'
import { sampleRooms } from '../data/sampleRooms.js'
import { communityPosts, trendingTopics, topContributors } from '../data/sampleCommunity.js'
import { achievements as sampleAchievements, reputationSeries } from '../data/sampleAchievements.js'
import { activityFeed } from '../data/sampleActivity.js'
import { weeklyFocus, upcomingSessions, weeklyLeaderboard } from '../data/sampleDashboard.js'
import { flashcardStats as sampleFlashcardStats } from '../data/sampleDecks.js'

/** Format a reputation number like 12400 -> "12.4K". */
function repK(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

let loadPromise = null

export const useContentStore = defineStore('content', {
  state: () => ({
    loaded: false,
    loading: false,

    profiles: [],
    subjects: [],
    notes: [],
    decks: [],
    rooms: [],
    posts: [],
    trending: [],
    contributors: [],
    achievements: [],
    activities: [],

    // Dashboard / profile analytics.
    weeklyFocus: null,
    reputationSeries: null,
    flashcardStats: null,
    leaderboard: [],
    sessions: []
  }),

  getters: {
    userById: (state) => (id) => state.profiles.find((u) => u.id === id) || null,
    subjectById: (state) => (id) => state.subjects.find((s) => s.id === id) || null,
    subjectByCode: (state) => (code) => state.subjects.find((s) => s.code === code) || null
  },

  actions: {
    /**
     * Create a flashcard deck (e.g. from AI-generated cards) and add it to the
     * top of the list so it shows immediately. Works live (Supabase) or in demo.
     */
    async createDeck(payload) {
      const deck = await deckService.createDeck(payload)
      this.decks.unshift(deck)
      return deck
    },

    /**
     * Create a community post and add it to the top of the feed so it shows
     * immediately. Works live (Supabase) or in demo. Mirrors createDeck.
     */
    async createPost(payload) {
      const post = await communityService.createPost(payload)
      this.posts.unshift(post)
      return post
    },

    /**
     * Persist a post's new vote count (the caller has already applied the
     * optimistic change to the reactive object). Silently ignores demo mode.
     */
    async persistVotes(postId, votes) {
      try {
        await communityService.setVotes(postId, votes)
      } catch (e) {
        console.warn('[community] vote not persisted:', e.message)
      }
    },

    /**
     * Keep the cached note title in sync after it's renamed in the editor, so
     * other views (e.g. the Flashcards note picker) don't show a stale title.
     */
    setNoteTitle(id, title) {
      const note = this.notes.find((n) => n.id === id)
      if (note) note.title = title
    },

    /**
     * Load every display collection exactly once. Safe to call from many
     * components/onMounted hooks — concurrent calls share the same promise.
     */
    async ensureLoaded() {
      if (this.loaded) return
      if (loadPromise) return loadPromise
      loadPromise = this._load()
      try {
        await loadPromise
      } finally {
        loadPromise = null
      }
    },

    async _load() {
      this.loading = true
      try {
        if (!isSupabaseConfigured) {
          this._loadDemo()
        } else {
          await this._loadFromDb()
        }
        this.loaded = true
      } finally {
        this.loading = false
      }
    },

    /** DEMO MODE — mirror the original sample data exactly (no visual change). */
    _loadDemo() {
      this.profiles = [...sampleUsers]
      this.subjects = [...sampleSubjects]
      this.notes = [...sampleNotes]
      this.decks = [...sampleDecks]
      this.rooms = [...sampleRooms]
      this.posts = communityPosts.map((p) => ({ ...p }))
      this.trending = [...trendingTopics]
      this.contributors = [...topContributors]
      this.achievements = [...sampleAchievements]
      this.activities = [...activityFeed]
      this.weeklyFocus = weeklyFocus
      this.reputationSeries = reputationSeries
      this.flashcardStats = sampleFlashcardStats
      this.leaderboard = [...weeklyLeaderboard]
      this.sessions = [...upcomingSessions]
    },

    /** LIVE MODE — everything comes from Supabase. No sample data is touched. */
    async _loadFromDb() {
      const [
        profilesRes,
        subjectsRes,
        notesRes,
        decksRes,
        roomsRes,
        postsRes,
        trendingRes,
        achievementsRes,
        activitiesRes,
        statsRes
      ] = await Promise.all([
        supabase.from('profiles').select('*').order('reputation', { ascending: false }),
        supabase.from('subjects').select('*').order('code'),
        supabase.from('notes').select('*').order('updated_at', { ascending: false }),
        supabase.from('decks').select('*, cards:deck_cards(*)').order('created_at'),
        supabase.from('study_rooms').select('*').order('created_at', { ascending: false }),
        supabase.from('community_posts').select('*, author:profiles(*)').order('created_at', { ascending: false }),
        supabase.from('trending_topics').select('*').order('posts', { ascending: false }),
        supabase.from('achievements').select('*').order('sort'),
        supabase.from('activities').select('*').order('created_at', { ascending: false }),
        supabase.from('study_stats').select('*').limit(1)
      ])

      // Surface the first error (if any) so demo data never silently sneaks in.
      const firstError = [
        profilesRes, subjectsRes, notesRes, decksRes, roomsRes,
        postsRes, trendingRes, achievementsRes, activitiesRes, statsRes
      ].map((r) => r.error).find(Boolean)
      if (firstError) throw firstError

      // profiles — alias avatar_url -> avatar so templates work unchanged.
      this.profiles = (profilesRes.data || []).map((p) => ({ ...p, avatar: p.avatar_url }))
      this.subjects = subjectsRes.data || []
      this.notes = notesRes.data || []

      // decks — map subject_code -> subject and sort each deck's cards.
      this.decks = (decksRes.data || []).map((d) => ({
        ...d,
        subject: d.subject_code,
        cards: (d.cards || []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      }))

      this.rooms = roomsRes.data || []

      // community posts — derive badge (author program) + relative time.
      this.posts = (postsRes.data || []).map((p) => ({
        ...p,
        subject: p.subject_code,
        badge: p.author?.program || '',
        ago: timeAgo(p.created_at)
      }))

      this.trending = trendingRes.data || []

      // achievements — alias description -> desc to match templates.
      this.achievements = (achievementsRes.data || []).map((a) => ({ ...a, desc: a.description }))

      // activity feed — rebuild the {key, to, actorId, ago} shape the feed uses.
      this.activities = (activitiesRes.data || []).map((a) => ({
        id: a.id,
        type: a.type,
        icon: a.icon,
        color: a.color,
        actorId: a.actor_id,
        ago: timeAgo(a.created_at),
        key: a.i18n_key,
        params: a.params || {},
        to: { name: a.route_name, params: a.route_params || {} }
      }))

      // Per-user analytics (jsonb columns). Charts read these directly.
      const stats = (statsRes.data && statsRes.data[0]) || {}
      this.weeklyFocus = stats.weekly_focus || { labels: [], values: [], max: 1 }
      this.reputationSeries = stats.reputation_series || { labels: [], values: [], max: 1, ytd: 0 }
      this.flashcardStats = stats.flashcard_stats || {
        mastered: 0, dueToday: 0, streak: 0, avgRecall: 0,
        reviewedLast7: [], todayCount: 0, weekCount: 0, retention: 0
      }

      // Leaderboard + top contributors are DERIVED from real profiles.
      const ranked = [...this.profiles].sort((a, b) => (b.reputation || 0) - (a.reputation || 0))
      this.leaderboard = ranked.slice(0, 5).map((u) => ({ id: u.id, full_name: u.full_name, points: u.reputation || 0 }))
      this.contributors = ranked.slice(0, 4).map((u) => ({ id: u.id, full_name: u.full_name, rep: repK(u.reputation || 0) }))

      // Upcoming sessions are derived from live rooms (no separate table).
      const palette = ['#6366f1', '#8b5cf6', '#10b981']
      this.sessions = this.rooms
        .filter((r) => r.live)
        .slice(0, 3)
        .map((r, i) => ({ id: r.id, title: r.name, when: 'Live now', joining: r.active_users, color: palette[i % palette.length], avatars: [] }))
    }
  }
})
