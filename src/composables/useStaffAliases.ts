import type { Ref } from 'vue'
import type { StaffAlias } from '@/api/staff/staff'
import { computed, ref, unref, watch } from 'vue'
import { listStaffAliases, threadStaffAliases } from '@/api/staff/staff'
import { primeMentionCache } from './useMentionResolve'

/**
 * 职位账号（开发人员匿名 @）前端缓存。
 *
 * - 全量职位列表模块级缓存一次（@ 下拉候选 + resolveMentions 缓存预热共用）；
 *   表为空（绝大多数用户/未配置时）返回 []，编辑器据此隐藏 @ 入口，对普通用户零打扰。
 * - 每个帖子线程内「可用来回复的职位身份」按 postID 缓存（仅被 @ 的开发人员非空）。
 * - 出参只有 alias / title / 职位小号 userID（后端保证），这里再统一做一次防御性清洗。
 */

const aliasesRef = ref<StaffAlias[]>([])
/** 职位列表加载/更新计数：渲染层引用它，列表到位后给已有 @职位 补上「职位」样式 */
export const staffAliasesVersion = ref(0)
let aliasesCache: StaffAlias[] | null = null
let aliasesPromise: Promise<StaffAlias[]> | null = null

const threadCache = new Map<number, StaffAlias[]>()

function primeAliases(aliases: StaffAlias[]) {
  // 预热 @ 提及缓存：帖子/评论里已写好的 @iwiki开发人员 直接渲染成可点击链接，
  // 不必等 resolveMentions 往返（小号本身就是 users 表里的账号，userID 即职位 ID）
  for (const a of aliases)
    primeMentionCache(a.alias, a.userID)
}

/** 全量职位候选（模块级缓存；失败/未配置恒为 []） */
export async function loadStaffAliases(force = false): Promise<StaffAlias[]> {
  if (aliasesCache && !force)
    return aliasesCache
  if (!aliasesPromise) {
    aliasesPromise = loadStaffAliasesInner().finally(() => {
      aliasesPromise = null
    })
  }
  return aliasesPromise
}

async function loadStaffAliasesInner(): Promise<StaffAlias[]> {
  const list = await listStaffAliases()
  aliasesCache = list
  aliasesRef.value = list
  staffAliasesVersion.value += 1
  primeAliases(list)
  return list
}

/** 编辑器 @ 入口用：响应式职位列表（未加载完成前为 []，入口自然隐藏） */
export function useStaffAliases() {
  void loadStaffAliases()
  return {
    staffAliases: computed(() => aliasesRef.value),
    hasStaffAliases: computed(() => aliasesRef.value.length > 0),
  }
}

/** 渲染期用：已知职位名集合（给 @ 高亮加「职位」样式） */
export function getStaffAliasNames(): Set<string> {
  return new Set(aliasesRef.value.map(a => a.alias))
}

/**
 * 当前用户在该帖子线程内可用的职位身份（「以 XX 身份回复」开关数据源）。
 * 普通用户恒为 []；按 postID 缓存，重复打开评论框不再请求。
 */
export async function fetchThreadStaffAliases(postID: number): Promise<StaffAlias[]> {
  if (!postID || postID <= 0)
    return []
  const cached = threadCache.get(postID)
  if (cached)
    return cached
  const list = await threadStaffAliases(postID)
  threadCache.set(postID, list)
  primeAliases(list)
  return list
}

/** 响应式版本：postID 变化自动重新取（用于常驻展示的场合） */
export function useThreadStaffAliases(postID: number | Ref<number>) {
  const out = ref<StaffAlias[]>([])
  watch(
    () => unref(postID),
    async (id) => {
      const list = await fetchThreadStaffAliases(id)
      if (unref(postID) === id)
        out.value = list
    },
    { immediate: true },
  )
  return out
}
