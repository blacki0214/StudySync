/**
 * main.js — application entry point.
 *
 * Bootstraps Vue, Pinia and Vue Router, and imports the global stylesheets.
 * CSS is imported here (not inside components) so the separated stylesheets in
 * src/styles are the single styling source, per the project brief.
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Third-party styles first, then our design system (so our tokens win).
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './styles/main.css'

// Bootstrap's JS (for dropdowns / collapse) — optional but handy.
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

import App from './App.vue'
import router from './router/index.js'
import { i18n } from './i18n/index.js'
import { registerDirectives } from './directives/index.js'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(i18n)
registerDirectives(app) // v-focus, v-click-outside, v-highlight
app.mount('#app')
