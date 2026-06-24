import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Vite configuration for the StudySync Vietnam Vue 3 project.
// The `@` alias points at /src so imports stay clean across the app.
export default defineConfig({
  plugins: [vue()],
  // Some browser-targeted libraries (e.g. @turbodocx/html-to-docx, used for the
  // note → .docx export) reference a bare `global`, which doesn't exist in the
  // browser. Alias it to `globalThis` so those guards resolve at runtime.
  define: {
    global: 'globalThis'
  },
  // Apply the same alias when Vite pre-bundles deps with esbuild (dev mode).
  optimizeDeps: {
    esbuildOptions: {
      define: { global: 'globalThis' }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    open: true
  }
})
