import type { ComputedRef, Ref } from 'vue'
import type { WornBadge } from '@/api/badge/badge'
import { computed, ref, watch } from 'vue'
import { fetchWornBadges } from '@/api/badge/badge'

/**
 * 帖子/评论作者昵称旁的「对外挂载勋章」。
 *
 * 一页里作者很多，逐个请求会 N+1；这里把同一轮渲染里出现的 userID 合并成一次
 * /badges/worn?ids=... 请求，并做进程内缓存。缓存里 null 代表「该用户没有挂勋章」，
 * 避免重复请求。用户自己保存展示设置后调用 primeWornBadge 直接更新缓存。
 */

const cache = new Map<number, WornBadge | null>()
const pending = new Set<number>()
const revision = ref(0)

let scheduled = false
let flushing = false
let flushTimer: ReturnType<typeof setTimeout> | null = null

function scheduleFlush() {
  if (scheduled)
    return
  scheduled = true
  flushTimer = setTimeout(() => {
    scheduled = false
    flushTimer = null
    void flush()
  }, 24)
}

async function flush() {
  if (flushing)
    return
  flushing = true
  try {
    while (pending.size > 0) {
      const ids = [...pending].filter(id => !cache.has(id)).slice(0, 100)
      for (const id of ids)
        pending.delete(id)
      if (ids.length === 0)
        break
      const badges = await fetchWornBadges(ids)
      for (const id of ids)
        cache.set(id, badges.get(id) ?? null)
      revision.value++
    }
  }
  finally {
    flushing = false
  }
  if (pending.size > 0)
    scheduleFlush()
}

function queue(userID: number) {
  if (userID <= 0 || cache.has(userID))
    return
  pending.add(userID)
  scheduleFlush()
}

/** 保存展示设置后直接写入缓存（badge=null 表示不挂），全站昵称立即同步。 */
export function primeWornBadge(userID: number, badge: WornBadge | null) {
  if (!Number.isFinite(userID) || userID <= 0)
    return
  cache.set(userID, badge)
  pending.delete(userID)
  revision.value++
}

/** 头像组件用：传入 userID（computed/ref/数字），返回响应式的挂载勋章。 */
export function useWornBadge(userID: Ref<number> | ComputedRef<number> | number) {
  const id = computed(() => {
    const raw = typeof userID === 'number' ? userID : userID.value
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : 0
  })

  watch(
    id,
    (value) => {
      if (value > 0)
        queue(value)
    },
    { immediate: true },
  )

  return computed<WornBadge | null>(() => {
    // 读取 revision，让批量请求回来后所有已挂载组件一起刷新。
    void revision.value
    if (id.value <= 0)
      return null
    return cache.get(id.value) ?? null
  })
}

/** 仅供测试/退出登录时清理缓存。 */
export function clearWornBadgeCache() {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
    scheduled = false
  }
  cache.clear()
  pending.clear()
  revision.value++
}
