import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { clearStaleNewSSEServiceWorker } from './utils/clearStaleServiceWorker'
import './assets/main.css'
import './assets/mode.css'
import './assets/comment-ui.scss'
import './assets/post-feed.scss'
import './assets/rating-hupu.scss'
import './assets/shop-zone.scss'
import 'virtual:uno.css'

void clearStaleNewSSEServiceWorker()

const app = createApp(App)
app.use(router)

app.mount('#app')
