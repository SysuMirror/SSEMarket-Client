import { createApp } from 'vue'

import { initEvia, trackPageHide, trackPageNavigation } from './analytics/evia'
import { initSessionReplay, recordReplayNavigation } from './analytics/replay'
import App from './App.vue'
import { initSkin } from './composables/useSkin'
import router from './router'
import { clearStaleNewSSEServiceWorker } from './utils/clearStaleServiceWorker'
import './assets/main.css'
import './assets/xq-overlay.css'
import './assets/mode.css'
import './assets/skin-base.css'
import './assets/skin-programmers-day-2026.css'
import './assets/comment-ui.scss'
import './assets/post-feed.scss'
import './assets/rating-hupu.scss'
import './assets/shop-zone.scss'
import 'virtual:uno.css'

void clearStaleNewSSEServiceWorker()

// 主题引导：同步应用本地主题（ModeButton 移入异步头部组件后，此处保证首帧前生效，避免闪白）
document.body.classList.toggle('dark-mode', (localStorage.getItem('mode') || '') === 'dark-mode')

// 皮肤引导：同步应用本地缓存的主题类；网络请求等登录态就绪后由 App 触发
initSkin()

// Evia 埋点：未配置环境变量时静默禁用
initEvia()
initSessionReplay()
router.afterEach((to, from) => {
  const routeName = String(to.name ?? to.path)
  const routeTemplate = to.matched.at(-1)?.path ?? to.path
  const fromRoute = from.name ? String(from.name) : (from.path === '/' ? '' : from.path)
  trackPageNavigation({
    routeName,
    routePath: to.path,
    routeTemplate,
    fromRoute,
  })
  recordReplayNavigation(routeTemplate)
})
window.addEventListener('pagehide', trackPageHide, { capture: true })

const app = createApp(App)
app.use(router)

app.mount('#app')
