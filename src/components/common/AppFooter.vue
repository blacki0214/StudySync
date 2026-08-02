<script setup>
/** AppFooter — small persistent footer inside the app shell. */
const year = new Date().getFullYear()
</script>

<template>
  <footer class="app-footer">
    © {{ year }} StudySync · Built with Vue 3, Pinia &amp; Supabase for COS30043.
  </footer>
</template>
