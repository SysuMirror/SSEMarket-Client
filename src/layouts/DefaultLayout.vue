<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
  watchEffect,
} from 'vue'

import { useRoute, useRouter } from 'vue-router'

import ModeButton from '@/components/ModeButton.vue'
import { useChat } from '@/composables/useChat'
import { usePWA } from '@/composables/usePWA'
import { useMusicStore } from '@/store/musicStore'
import { useNewPostsStore } from '@/store/newPostsStore'
import { useNoticeStore } from '@/store/noticeStore'
import { handleHomeNavClick } from '@/utils/scrollHome'
import { showSnackbar } from '@/utils/snackbar'

const BottomNavbar = defineAsyncComponent(
  () => import('@/components/BottomNavbar.vue'),
)
const PcHeader = defineAsyncComponent(
  () => import('@/components/PcHeader.vue'),
)
const PwaPcHeader = defineAsyncComponent(
  () => import('@/components/PwaPcHeader.vue'),
)

const PartitionList = defineAsyncComponent(() => import('@/components/PartitionList.vue'))
const MobileHeader = defineAsyncComponent(() => import('@/components/MobileHeader.vue'))
const route = useRoute()
const router = useRouter()

const { noticeNum, refreshNoticeNum } = useNoticeStore()
// 全局播放器出现时收紧主内容高度，避免底栏盖住内容
const { current: currentMusic } = useMusicStore()
const { startPolling, stopPolling, newPostsNotification, hideNotification } = useNewPostsStore()

const { connect, disconnect, chatNum } = useChat()
const { desktopExperienceEnabled } = usePWA()

const windowWidth = ref(window.innerWidth)
const isPC = computed(() => {
  return windowWidth.value > 768
})
provide('isPC', isPC)

const isDesktopExperience = computed(() => isPC.value && desktopExperienceEnabled.value)

// PWA/电脑端菜单状态管理
const pwaMenuOpen = ref(true)

// 同步到 body：全局固定定位层（播放栏等）据此避让 PWA 侧边栏
watchEffect(() => {
  document.body.classList.toggle('pwa-sidebar-open', isDesktopExperience.value && pwaMenuOpen.value)
})

// 计算是否应该折叠菜单
const isMenuCollapsed = computed(() => {
  if (!isDesktopExperience.value) {
    return false
  }
  // 菜单关闭时返回true（折叠状态）
  return !pwaMenuOpen.value
})

// 新增：输入框焦点状态
const isAnyInputFocused = ref(false)
provide('isAnyInputFocused', isAnyInputFocused)

function updateWidth() {
  windowWidth.value = window.innerWidth
}

/** 首页 / 分区流 / 打分区：显示顶部分区横条（含「打分」入口） */
const isHomePage = computed(() => {
  const seg = route.path.split('/').filter(Boolean)[0] ?? ''
  return seg === '' || seg === 'partition' || seg === 'rating'
})

/** 子页占满顶栏与主区域之间剩余高度，禁止整页滚动（如小秋） */
const layoutFill = computed(() => Boolean(route.meta.layoutFill))

function onTitleHomeClick(e: MouseEvent) {
  handleHomeNavClick(e, route)
}

onMounted(() => {
  connect()
  refreshNoticeNum()
  window.addEventListener('resize', updateWidth)

  // 导入模块并注册
  import('@/utils/focusHandler').then(({ setupFocusHandlers }) => {
    const _ = setupFocusHandlers(
      () => { isAnyInputFocused.value = true },
      () => { isAnyInputFocused.value = false },
    )
    // 可选：提供给子组件使用
    // provide('focusCleanup', _);
  })

  // 启动新帖子轮询
  startPolling()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateWidth)

  // 停止新帖子轮询
  stopPolling()
  disconnect()
})

// 监听新帖子通知变化，显示Snackbar
watch(() => newPostsNotification.updatedAt, (updatedAt: number) => {
  if (updatedAt > 0 && newPostsNotification.isVisible) {
    const isCurrentlyOnHomePage = route.path === '/' || route.path === '/partition'

    showSnackbar({
      id: 'new-posts-notification',
      message: `有 ${newPostsNotification.newPostIds.length} 条未查看的新帖子`,
      actionText: isCurrentlyOnHomePage ? '去查看' : '去首页查看',
      type: 'info',
      position: isPC.value ? 'top' : 'bottom',
      alwaysShow: true,
      onAction: () => {
        hideNotification()
        router.push({ path: '/', query: { refresh: Date.now() } })
      },
      onClose: () => {
        hideNotification()
      },
    })
  }
})
</script>

<template>
  <div
    class="root w-full"
    :class="{
      'pwa-mode': isDesktopExperience,
      'root--layout-fill': layoutFill,
      'root--input-focused': isAnyInputFocused && !isPC,
      'root--has-player': !!currentMusic,
    }"
  >
    <header class="site-header-stack">
      <div class="site-top">
        <div class="top-left" />
        <RouterLink class="title" to="/" @click="onTitleHomeClick">
          SSE MARKET
        </RouterLink>
        <div class="top-right">
          <ModeButton />
        </div>
      </div>
      <template v-if="isPC">
        <PwaPcHeader v-if="isDesktopExperience" v-model:menu-open="pwaMenuOpen" :unread-chat-num="chatNum" :unread-notice-num="noticeNum.unreadTotalNum" />
        <PcHeader v-else :unread-chat-num="chatNum" :unread-notice-num="noticeNum.unreadTotalNum" />
      </template>
      <template v-else>
        <MobileHeader />
      </template>
    </header>
    <template v-if="!isPC">
      <BottomNavbar
        v-show="!isAnyInputFocused"
        :notice-num="noticeNum.unreadTotalNum"
        :chat-num="chatNum"
      />
    </template>
    <main
      class="app-main w-full flex flex-row p-0"
      :class="{ 'app-main--layout-fill': layoutFill }"
    >
      <div
        class="content"
        :class="{
          'menu-collapsed': isMenuCollapsed,
          'content--layout-fill': layoutFill,
        }"
        :data-menu-collapsed="isMenuCollapsed"
      >
        <template v-if="!isPC && isHomePage">
          <PartitionList />
        </template>
        <router-view v-slot="{ Component }">
          <KeepAlive include="HomeView,PartitionView">
            <component :is="Component" :key="route.fullPath" />
          </KeepAlive>
        </router-view>
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
/* 顶栏高度变量：全端固定导航，主内容用 padding-top 避让 */
.site-header-stack {
  --layout-site-top-h: 1.875rem;
  --layout-nav-h: 2.75rem;
  --layout-header-h: calc(var(--layout-site-top-h) + var(--layout-nav-h));
  /* 兼容 PWA 侧栏组件内联样式 */
  --pc-site-top-h: var(--layout-site-top-h);
  --pc-nav-h: var(--layout-nav-h);
  --pc-header-total: var(--layout-header-h);

  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2100;
  width: 100%;
  background: #0f172a;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

/* 二级导航（搜索/链接条）统一高度，避免主内容遮挡计算不准 */
.site-header-stack :deep(.site-header),
.site-header-stack :deep(.pwa-header) {
  flex-shrink: 0;
  min-height: var(--layout-nav-h);
  height: var(--layout-nav-h);
  box-sizing: border-box;
}

.site-top {
  display: flex;
  align-items: center;
  min-height: var(--layout-site-top-h);
  background: #0f172a;

  .title {
    flex: 1;
    color: #eee;
    text-align: center;
    margin: 0;
    padding: 0 0.35rem;
    letter-spacing: 0.14em;
    font-size: 14px;
    line-height: 1.15;
    font-family: 'Ubuntu Mono', Arial, Helvetica, sans-serif;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .top-left,
  .top-right {
    width: 0;
    display: flex;
    align-items: center;
    justify-content: end;
    padding: 0 0.5rem;
  }
}

/* 主内容区：顶栏下方独立滚动，避免 body 滚动时内容滑入顶栏下方 */
.root {
  --layout-bottom-nav-h: calc(52px + env(safe-area-inset-bottom, 0px));

  display: flex;
  flex-direction: column;
  height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
  box-sizing: border-box;
}

.app-main {
  flex: 1 1 auto;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  min-height: 0;
  margin: 0;
  margin-top: var(--layout-header-h);
  height: calc(100dvh - var(--layout-header-h));
  max-height: calc(100dvh - var(--layout-header-h));
  overflow: hidden;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

/* 由 .content 承担纵向滚动；子路由不得 flex-shrink，否则详情页等会被压进视口高度无法滚动 */
.content:not(.content--layout-fill) {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  scroll-padding-top: 12px;
  align-items: stretch;
}

.content:not(.content--layout-fill) > * {
  flex-shrink: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.content {
  width: 100%;
  padding: 10px 0 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition:
    margin-left 0.3s ease,
    width 0.3s ease;
}

@media screen and (min-width: 769px) {
  .content {
    padding: 12px 5% 24px;
  }
}

@media screen and (max-width: 768px) {
  .app-main:not(.app-main--layout-fill) {
    height: calc(100dvh - var(--layout-header-h) - var(--layout-bottom-nav-h));
    max-height: calc(100dvh - var(--layout-header-h) - var(--layout-bottom-nav-h));
  }

  /* 输入法聚焦时底栏已隐藏，不再预留底栏高度，避免输入框与键盘之间留白 */
  .root.root--input-focused:not(.root--layout-fill) .app-main:not(.app-main--layout-fill) {
    height: calc(100dvh - var(--layout-header-h));
    max-height: calc(100dvh - var(--layout-header-h));
  }

  .root.root--input-focused.root--layout-fill > .app-main.app-main--layout-fill {
    height: calc(100dvh - var(--layout-header-h));
    max-height: calc(100dvh - var(--layout-header-h));
  }

  .content {
    padding-top: 0;
    padding-bottom: 16px;
  }

  /* 移动端首页分区条 sticky */
  .content > .partition-strip-wrap,
  .content > * > .partition-strip-wrap {
    position: sticky;
    top: 0;
    z-index: 5;
  }

  .root.root--layout-fill .content.content--layout-fill {
    padding-bottom: 0;
  }
}

/* PWA 桌面：侧栏 + 主内容分区 */
.root.pwa-mode {
  position: relative;
}

.root.pwa-mode .site-top {
  min-height: var(--layout-site-top-h);
}

@media screen and (min-width: 769px) {
  .root.pwa-mode .content:not(.menu-collapsed) {
    margin-left: 280px;
    width: calc(100% - 280px);
  }

  .root.pwa-mode .content.menu-collapsed {
    margin-left: 0;
    width: 100%;
  }
}

@media screen and (max-width: 768px) {
  .root.pwa-mode .content:not(.menu-collapsed),
  .root.pwa-mode .content.menu-collapsed {
    margin-left: 0;
    width: 100%;
  }
}

/* 发帖 / 小秋：主区域不滚动，子页面内部滚动 */
.root.root--layout-fill > .app-main.app-main--layout-fill {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  margin-top: var(--layout-header-h);
  height: calc(100dvh - var(--layout-header-h));
  max-height: calc(100dvh - var(--layout-header-h));
}

@media screen and (max-width: 768px) {
  .root.root--layout-fill > .app-main.app-main--layout-fill {
    height: calc(100dvh - var(--layout-header-h) - var(--layout-bottom-nav-h));
    max-height: calc(100dvh - var(--layout-header-h) - var(--layout-bottom-nav-h));
  }
}

.root.root--layout-fill .content.content--layout-fill {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  max-width: none;
  padding: 0;
  padding-bottom: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: stretch;

  > :deep(*) {
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
  }
}

/* ---------- 全局音乐播放器底栏出现时的避让 ---------- */
@media screen and (min-width: 769px) {
  .root--has-player .app-main:not(.app-main--layout-fill) {
    height: calc(100dvh - var(--layout-header-h) - 64px);
    max-height: calc(100dvh - var(--layout-header-h) - 64px);
  }
}

@media screen and (max-width: 768px) {
  .root--has-player .app-main:not(.app-main--layout-fill) {
    height: calc(100dvh - var(--layout-header-h) - var(--layout-bottom-nav-h) - 64px);
    max-height: calc(100dvh - var(--layout-header-h) - var(--layout-bottom-nav-h) - 64px);
  }

  .root--has-player .content:not(.content--layout-fill) {
    padding-bottom: 24px;
  }
}
</style>
