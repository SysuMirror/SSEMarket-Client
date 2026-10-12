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

import { useChat } from '@/composables/useChat'
import { usePWA } from '@/composables/usePWA'
import { useNewPostsStore } from '@/store/newPostsStore'
import { useNoticeStore } from '@/store/noticeStore'
import { showSnackbar } from '@/utils/snackbar'
import IWikiFloatingEntry from '@/components/IWikiFloatingEntry.vue'

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

/**
 * 失焦回落防抖（~280ms）：移动端点按"发送"等按钮时，pointerdown 会先让
 * 输入框 blur——若立刻恢复底栏与页底预留，布局在 click 派发前移动，
 * 第一次点击落到按钮原位之外而落空（表现为按钮按灰了但没发送，要点第二次）。
 * 延迟到 click 完成后再恢复；期间再次聚焦（切换输入框）则取消回落。
 */
let inputBlurTimer: ReturnType<typeof setTimeout> | undefined
function markInputFocused() {
  if (inputBlurTimer)
    clearTimeout(inputBlurTimer)
  isAnyInputFocused.value = true
}
function markInputBlurred() {
  if (inputBlurTimer)
    clearTimeout(inputBlurTimer)
  inputBlurTimer = setTimeout(() => {
    isAnyInputFocused.value = false
    inputBlurTimer = undefined
  }, 280)
}

function updateWidth() {
  windowWidth.value = window.innerWidth
}

/** 首页 / 分区流 / 打分区 / 小说浏览区：显示顶部分区横条（含「打分」「小说」入口）；阅读页与写作页沉浸展示，不带横条 */
const isHomePage = computed(() => {
  const seg = route.path.split('/').filter(Boolean)[0] ?? ''
  if (seg === 'novel')
    return route.name !== 'NovelReader' && route.name !== 'NovelWrite'
  return seg === '' || seg === 'partition' || seg === 'rating'
})

/** 子页占满顶栏与主区域之间剩余高度，禁止整页滚动（如小秋） */
const layoutFill = computed(() => Boolean(route.meta.layoutFill))

onMounted(() => {
  connect()
  refreshNoticeNum()
  window.addEventListener('resize', updateWidth)

  // 导入模块并注册
  import('@/utils/focusHandler').then(({ setupFocusHandlers }) => {
    const _ = setupFocusHandlers(markInputFocused, markInputBlurred)
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
    }"
  >
    <header class="site-header-stack">
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
            <component :is="Component" :key="route.path" />
          </KeepAlive>
        </router-view>
      </div>
    </main>
    <IWikiFloatingEntry v-if="!layoutFill && !isAnyInputFocused" />
  </div>
</template>

<style lang="scss" scoped>
/* 顶栏高度变量：全端固定导航，主内容用 padding-top 避让 */
.site-header-stack {
  /* 原 site-top 品牌条已移除（2026-09-15），保留变量让旧引用归零即可 */
  --layout-site-top-h: 0rem;
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
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

@supports not (
  (
    backdrop-filter: blur(1px),
  )
) {
  .site-header-stack {
    background: #0f172a;
  }
}

/* 二级导航（搜索/链接条）统一高度，避免主内容遮挡计算不准 */
.site-header-stack :deep(.site-header),
.site-header-stack :deep(.pwa-header) {
  flex-shrink: 0;
  min-height: var(--layout-nav-h);
  height: var(--layout-nav-h);
  box-sizing: border-box;
}

/* 主内容区：顶栏下方独立滚动，避免 body 滚动时内容滑入顶栏下方 */
.root {
  display: flex;
  flex-direction: column;
  /* 老系统回退：不支持 dvh 的浏览器（iOS<15.4 等）退到 vh，再由 flex 约束内容 */
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  box-sizing: border-box;
}

@supports (height: 100dvh) {
  .root {
    height: 100dvh;
    max-height: 100dvh;
  }
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
  overscroll-behavior-y: auto;
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
  .site-header-stack {
    background: var(--color-card, #fff);
    /* iOS：移动端背景已不透明，backdrop-filter 属纯 GPU 开销，是滚动卡顿主因之一 */
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .app-main:not(.app-main--layout-fill) {
    height: calc(100dvh - var(--layout-header-h));
    max-height: calc(100dvh - var(--layout-header-h));
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

  /* iOS Safari 不把 flex 列滚动容器的 padding-bottom 计入可滚动范围，
     底部内容滚不出底栏遮挡区（安卓 Chrome 正常）；
     改用 ::after 垫片预留底栏高度（真实 flex item 始终计入 scrollHeight）。
     --layout-bottom-nav-h 由 BottomNavbar 用 ResizeObserver 实测 offsetHeight 写入 */
  .content:not(.content--layout-fill)::after {
    content: '';
    display: block;
    flex: 0 0 auto;
    width: 100%;
    height: var(--layout-bottom-nav-h, calc(52px + env(safe-area-inset-bottom, 0px)));
  }

  .root.root--input-focused .content:not(.content--layout-fill)::after {
    height: 0;
  }

  /* 移动端首页分区条 sticky */
  .content > .partition-strip-wrap,
  .content > * > .partition-strip-wrap {
    position: sticky;
    top: 0;
    z-index: 5;
  }
}

/* PWA 桌面：侧栏 + 主内容分区 */
.root.pwa-mode {
  position: relative;
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
    height: calc(100dvh - var(--layout-header-h));
    max-height: calc(100dvh - var(--layout-header-h));
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

/* 移动端满高页（私信/小秋/发帖）底栏预留。
   必须放在上面的基础规则之后：此前写在首个 media 块里，被这里的
   padding:0 同特异性后向覆盖，从未生效——满高页底部（含输入栏）
   一直被固定底栏盖住（安卓 69px / iPhone 更多，含安全区） */
@media screen and (max-width: 768px) {
  .root.root--layout-fill .content.content--layout-fill {
    padding-bottom: var(--layout-bottom-nav-h, calc(52px + env(safe-area-inset-bottom, 0px)));
  }

  .root.root--input-focused.root--layout-fill .content.content--layout-fill {
    padding-bottom: 0;
  }
}

/* ---------- 全局音乐播放器避让 ----------
   底栏高度由 PlayerBar 组件经 --music-bar-h 变量自行声明（不可见时为 0px），
   布局只消费变量；普通页与满高页（发帖/私信/小秋）同样生效。
   移动端播放器为悬浮球（overlay），变量恒为 0，不受影响。 */
@media screen and (min-width: 769px) {
  .app-main:not(.app-main--layout-fill) {
    height: calc(100dvh - var(--layout-header-h) - var(--music-bar-h, 0px));
    max-height: calc(100dvh - var(--layout-header-h) - var(--music-bar-h, 0px));
  }

  .root.root--layout-fill > .app-main.app-main--layout-fill {
    height: calc(100dvh - var(--layout-header-h) - var(--music-bar-h, 0px));
    max-height: calc(100dvh - var(--layout-header-h) - var(--music-bar-h, 0px));
  }
}
</style>
