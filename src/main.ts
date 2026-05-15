import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import './assets/main.css'
import './assets/mode.css'
import 'virtual:uno.css'
import { clearStaleNewSSEServiceWorker } from './utils/clearStaleServiceWorker'

void clearStaleNewSSEServiceWorker()

const app = createApp(App)
app.use(router)

app.mount('#app')
