import type { Router } from 'vue-router'
import { nextTick } from 'vue'
import { getAppMainScrollContainer, getWindowScrollY, setWindowScrollY } from '@/utils/windowScroll'

/**
 * 应用内滚动容器（.content）不是 window，浏览器不会自动恢复它的位置。
 * 这里按 fullPath 记录离开时的滚动位置：返回/前进时恢复，进入新页面时回顶。
 */
const positions = new Map<string, number>()
const seenPositions = new Set<number>()
let lastPosition: number | null = null

/** 自己管理缓存与滚动的帖子列表页，前进时交给它们的 onActivated 处理 */
const SELF_MANAGED_SCROLL = new Set(['Home', 'Partition', 'Search', 'Course', 'Save', 'History'])

let installed = false

function currentHistoryPosition(): number | null {
  const position = (window.history.state as { position?: unknown } | null)?.position
  return typeof position === 'number' ? position : null
}

/**
 * 反复尝试写入滚动位置：数据异步到达后内容高度才够，单次设置会被钳制。
 * 用户一旦自己滚动就立即停止，避免和用户抢滚动条。
 */
function applyScroll(top: number, holdMs: number) {
  let cancelled = false
  const cleanup = () => {
    cancelled = true
    window.removeEventListener('wheel', cancel)
    window.removeEventListener('touchstart', cancel)
  }
  const cancel = () => {
    cleanup()
  }
  window.addEventListener('wheel', cancel, { passive: true })
  window.addEventListener('touchstart', cancel, { passive: true })

  const startedAt = Date.now()
  const tick = () => {
    if (cancelled)
      return
    setWindowScrollY(top)
    const container = getAppMainScrollContainer()
    if ((container && Math.abs(container.scrollTop - top) < 2) || Date.now() - startedAt >= holdMs) {
      cleanup()
      return
    }
    requestAnimationFrame(tick)
  }
  nextTick(() => requestAnimationFrame(tick))
}

export function installRouteScrollMemory(router: Router) {
  if (installed || typeof window === 'undefined')
    return
  installed = true

  router.beforeEach((to, from) => {
    if (from.fullPath !== to.fullPath)
      positions.set(from.fullPath, getWindowScrollY())
  })

  router.afterEach((to, _from, failure) => {
    if (failure)
      return

    // 返回会跳到访问过的历史位置；前进则回到已见过的位置；
    // 新 push 会拿到一个从没出现过的 position。不能靠 popstate 事件判断：
    // vue-router 的监听器先注册，同步导航会先跑完 afterEach 再轮到我们的回调。
    const position = currentHistoryPosition()
    let isPop = false
    if (position !== null) {
      if (lastPosition !== null && position !== lastPosition)
        isPop = seenPositions.has(position) || position < lastPosition
      seenPositions.add(position)
      lastPosition = position
    }

    if (isPop) {
      const saved = positions.get(to.fullPath)
      applyScroll(saved ?? 0, saved ? 3000 : 0)
      return
    }

    // 新页面从顶部开始；帖子列表页由自身缓存逻辑负责
    if (!SELF_MANAGED_SCROLL.has(String(to.name)))
      applyScroll(0, 0)
  })
}
