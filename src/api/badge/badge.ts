import { requestFunc } from '../req'

/**
 * 勋章系统接口。
 *
 * GET  /badges/user/:userID  他人主页勋章墙（公开）
 * GET  /badges/worn?ids=...  批量取一批用户对外挂载的勋章（公开）
 * GET  /auth/badges          我的全部勋章 + 展示偏好（登录）
 * POST /auth/badges/prefs    保存对外挂载 / 主页展示范围（登录）
 *
 * 图片全部是图床返回的绝对 http(s) 地址，前端原样使用。
 */

const apiUrl = import.meta.env.VITE_API_BASE_URL

export interface Badge {
  badgeID: number
  code: string
  name: string
  description: string
  imageURL: string
  category: string
  awardedAt?: string
}

export interface MyBadges {
  badges: Badge[]
  /** 对外（帖子/评论昵称旁）挂载的勋章；0 = 不挂。 */
  wornBadgeId: number
  /** 主页展示范围：null = 默认全部展示；[] = 明确不展示。 */
  profileBadgeIds: number[] | null
}

export interface WornBadge {
  userID: number
  badgeID: number
  name: string
  imageURL: string
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function normalizeBadge(raw: unknown): Badge | null {
  if (!raw || typeof raw !== 'object')
    return null
  const d = raw as Record<string, unknown>
  const badgeID = num(d.badgeID)
  const imageURL = typeof d.imageURL === 'string' ? d.imageURL.trim() : ''
  if (badgeID <= 0 || !/^https?:\/\//i.test(imageURL))
    return null
  return {
    badgeID,
    code: typeof d.code === 'string' ? d.code : '',
    name: typeof d.name === 'string' ? d.name : '',
    description: typeof d.description === 'string' ? d.description : '',
    imageURL,
    category: typeof d.category === 'string' ? d.category : '',
    awardedAt: typeof d.awardedAt === 'string' ? d.awardedAt : undefined,
  }
}

function normalizeBadgeList(raw: unknown): Badge[] {
  if (!Array.isArray(raw))
    return []
  return raw.map(normalizeBadge).filter((b): b is Badge => !!b)
}

function normalizeProfileBadgeIds(raw: unknown): number[] | null {
  // null / undefined = 默认全部；数组（含 []）= 明确选择。
  if (!Array.isArray(raw))
    return null
  const ids: number[] = []
  for (const value of raw) {
    const id = num(value)
    if (id > 0 && !ids.includes(id))
      ids.push(id)
  }
  return ids
}

function normalizeMyBadges(raw: unknown): MyBadges | null {
  if (!raw || typeof raw !== 'object')
    return null
  const d = raw as Record<string, unknown>
  return {
    badges: normalizeBadgeList(d.badges),
    wornBadgeId: num(d.wornBadgeId),
    profileBadgeIds: normalizeProfileBadgeIds(d.profileBadgeIds),
  }
}

async function readJson(res: Response | null): Promise<{ code?: number, msg?: string, data?: unknown } | null> {
  if (!res)
    return null
  try {
    return await res.json()
  }
  catch {
    return null
  }
}

/** 我的全部勋章与展示偏好；失败返回 null（页面不阻塞）。 */
export async function fetchMyBadges(): Promise<MyBadges | null> {
  try {
    const res = await requestFunc('/auth/badges', {
      method: 'GET',
      headers: {},
    }, true)
    const json = await readJson(res)
    if (!json || json.code !== 200)
      return null
    return normalizeMyBadges(json.data)
  }
  catch (e) {
    console.error('[badge] fetch mine failed', e)
    return null
  }
}

/** 他人主页勋章墙（已按对方主页展示偏好过滤）。 */
export async function fetchUserBadges(userID: number): Promise<MyBadges | null> {
  if (userID <= 0)
    return null
  try {
    const res = await fetch(`${apiUrl}/badges/user/${userID}`, { cache: 'no-store' })
    if (!res.ok)
      return null
    const json = await readJson(res)
    if (!json || json.code !== 200)
      return null
    return normalizeMyBadges(json.data)
  }
  catch (e) {
    console.error('[badge] fetch user failed', e)
    return null
  }
}

/** 批量取对外挂载勋章；一次最多 100 个用户。 */
export async function fetchWornBadges(userIDs: number[]): Promise<Map<number, WornBadge>> {
  const result = new Map<number, WornBadge>()
  const ids = [...new Set(userIDs.filter(id => Number.isFinite(id) && id > 0))].slice(0, 100)
  if (ids.length === 0)
    return result
  try {
    const res = await fetch(`${apiUrl}/badges/worn?ids=${ids.join(',')}`, { cache: 'no-store' })
    if (!res.ok)
      return result
    const json = await readJson(res)
    if (!json || json.code !== 200)
      return result
    const data = json.data as { badges?: unknown } | undefined
    if (!Array.isArray(data?.badges))
      return result
    for (const item of data.badges) {
      if (!item || typeof item !== 'object')
        continue
      const d = item as Record<string, unknown>
      const userID = num(d.userID)
      const badgeID = num(d.badgeID)
      const imageURL = typeof d.imageURL === 'string' ? d.imageURL.trim() : ''
      if (userID <= 0 || badgeID <= 0 || !/^https?:\/\//i.test(imageURL))
        continue
      result.set(userID, {
        userID,
        badgeID,
        name: typeof d.name === 'string' ? d.name : '',
        imageURL,
      })
    }
  }
  catch (e) {
    console.error('[badge] fetch worn failed', e)
  }
  return result
}

export interface SaveBadgePrefsResult {
  ok: boolean
  msg: string
  data: MyBadges | null
}

/** 保存展示偏好：wornBadgeId=0 不挂；profileBadgeIds=null 恢复默认全部。 */
export async function saveBadgePreferences(input: {
  wornBadgeId: number
  profileBadgeIds: number[] | null
}): Promise<SaveBadgePrefsResult> {
  try {
    const res = await requestFunc('/auth/badges/prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        wornBadgeId: input.wornBadgeId,
        profileBadgeIds: input.profileBadgeIds,
      },
    }, true)
    const json = await readJson(res)
    if (!json || json.code !== 200)
      return { ok: false, msg: json?.msg || '保存失败', data: null }
    return { ok: true, msg: json.msg || '已保存', data: normalizeMyBadges(json.data) }
  }
  catch (e) {
    console.error('[badge] save prefs failed', e)
    return { ok: false, msg: '网络异常，请稍后重试', data: null }
  }
}
