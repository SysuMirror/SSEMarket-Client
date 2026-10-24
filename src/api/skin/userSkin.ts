import { useUserStore } from '@/store/userStore'
import { requestFunc } from '../req'

/**
 * 用户自定义皮肤（桌面/手机双图）接口。
 *
 * GET  /auth/skins/mine          我的皮肤库
 * POST /auth/skins/create        新建（默认私密）
 * GET  /auth/skins/search        搜索公开皮肤
 * POST /auth/skins/visibility    作者公开/私密
 * POST /auth/skins/delete        作者删除
 * POST /auth/skins/add           添加公开皮肤到皮肤库
 * POST /auth/skins/remove        从皮肤库移除
 * POST /auth/skins/addByToken    分享链接添加
 * GET  /skins/share/:token       分享链接预览（公开）
 */

const apiUrl = import.meta.env.VITE_API_BASE_URL

export interface UserSkin {
  skinID: number
  name: string
  description: string
  desktopUrl: string
  mobileUrl: string
  isPublic: boolean
  ownerID: number
  ownerName: string
  isOwner: boolean
  inLibrary: boolean
  shareToken?: string
  createdAt?: string
}

/** useSkin 只需要背景解析所需的字段。 */
export interface ActiveCustomSkin {
  skinID: number
  name: string
  desktopUrl: string
  mobileUrl: string
  ownerName?: string
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function remoteURL(value: unknown): string {
  if (typeof value !== 'string')
    return ''
  const url = value.trim()
  return /^https?:\/\//i.test(url) ? url : ''
}

export function normalizeUserSkin(raw: unknown): UserSkin | null {
  if (!raw || typeof raw !== 'object')
    return null
  const d = raw as Record<string, unknown>
  const skinID = num(d.skinID)
  const desktopUrl = remoteURL(d.desktopUrl)
  const mobileUrl = remoteURL(d.mobileUrl)
  if (skinID <= 0 || !desktopUrl || !mobileUrl)
    return null
  return {
    skinID,
    name: typeof d.name === 'string' ? d.name : '',
    description: typeof d.description === 'string' ? d.description : '',
    desktopUrl,
    mobileUrl,
    isPublic: d.isPublic === true,
    ownerID: num(d.ownerID),
    ownerName: typeof d.ownerName === 'string' ? d.ownerName : '',
    isOwner: d.isOwner === true,
    inLibrary: d.inLibrary === true,
    shareToken: typeof d.shareToken === 'string' ? d.shareToken : undefined,
    createdAt: typeof d.createdAt === 'string' ? d.createdAt : undefined,
  }
}

export function normalizeActiveCustomSkin(raw: unknown): ActiveCustomSkin | null {
  const skin = normalizeUserSkin(raw)
  if (!skin)
    return null
  return {
    skinID: skin.skinID,
    name: skin.name,
    desktopUrl: skin.desktopUrl,
    mobileUrl: skin.mobileUrl,
    ownerName: skin.ownerName,
  }
}

function normalizeSkinList(raw: unknown): UserSkin[] {
  if (!Array.isArray(raw))
    return []
  return raw.map(normalizeUserSkin).filter((s): s is UserSkin => !!s)
}

async function readJSON(res: Response | null): Promise<{ code?: number, msg?: string, data?: unknown } | null> {
  if (!res)
    return null
  try {
    return await res.json()
  }
  catch {
    return null
  }
}

async function authGet(path: string, query?: Record<string, string>): Promise<{ code?: number, msg?: string, data?: unknown } | null> {
  try {
    const res = await requestFunc(path, { method: 'GET', headers: {}, query }, true)
    return await readJSON(res)
  }
  catch (e) {
    console.error('[skin] request failed', path, e)
    return null
  }
}

async function authPost(path: string, body: Record<string, unknown>): Promise<{ code?: number, msg?: string, data?: unknown } | null> {
  try {
    const res = await requestFunc(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }, true)
    return await readJSON(res)
  }
  catch (e) {
    console.error('[skin] request failed', path, e)
    return null
  }
}

export async function fetchMySkins(): Promise<UserSkin[]> {
  const json = await authGet('/auth/skins/mine')
  if (!json || json.code !== 200)
    return []
  return normalizeSkinList((json.data as { skins?: unknown } | undefined)?.skins)
}

export async function searchUserSkins(keyword: string, limit = 20): Promise<UserSkin[]> {
  const json = await authGet('/auth/skins/search', {
    q: keyword,
    limit: String(limit),
  })
  if (!json || json.code !== 200)
    return []
  return normalizeSkinList((json.data as { skins?: unknown } | undefined)?.skins)
}

export interface SkinResult {
  ok: boolean
  msg: string
  skin: UserSkin | null
}

function skinResult(json: { code?: number, msg?: string, data?: unknown } | null, fallback: string): SkinResult {
  if (!json || json.code !== 200)
    return { ok: false, msg: json?.msg || fallback, skin: null }
  const skin = normalizeUserSkin((json.data as { skin?: unknown } | undefined)?.skin)
  return { ok: true, msg: json.msg || '', skin }
}

export async function createUserSkin(input: {
  name: string
  description: string
  desktopUrl: string
  mobileUrl: string
}): Promise<SkinResult> {
  return skinResult(await authPost('/auth/skins/create', input), '创建皮肤失败')
}

export async function setUserSkinVisibility(skinID: number, isPublic: boolean): Promise<SkinResult> {
  return skinResult(await authPost('/auth/skins/visibility', { skinID, isPublic }), '更新公开状态失败')
}

export async function addUserSkin(skinID: number): Promise<SkinResult> {
  return skinResult(await authPost('/auth/skins/add', { skinID }), '添加皮肤失败')
}

export async function addUserSkinByToken(token: string): Promise<SkinResult> {
  return skinResult(await authPost('/auth/skins/addByToken', { token }), '添加皮肤失败')
}

export interface SimpleResult {
  ok: boolean
  msg: string
}

async function simplePost(path: string, body: Record<string, unknown>, fallback: string): Promise<SimpleResult> {
  const json = await authPost(path, body)
  if (!json || json.code !== 200)
    return { ok: false, msg: json?.msg || fallback }
  return { ok: true, msg: json.msg || '' }
}

export function deleteUserSkin(skinID: number): Promise<SimpleResult> {
  return simplePost('/auth/skins/delete', { skinID }, '删除皮肤失败')
}

export function removeUserSkin(skinID: number): Promise<SimpleResult> {
  return simplePost('/auth/skins/remove', { skinID }, '移除皮肤失败')
}

export async function fetchSharedSkin(token: string): Promise<UserSkin | null> {
  if (!token)
    return null
  try {
    const auth = useUserStore().token.value
    const res = await fetch(`${apiUrl}/skins/share/${encodeURIComponent(token)}`, {
      cache: 'no-store',
      headers: auth ? { Authorization: `Bearer ${auth}` } : {},
    })
    if (!res.ok)
      return null
    const json = await readJSON(res)
    if (!json || json.code !== 200)
      return null
    return normalizeUserSkin((json.data as { skin?: unknown } | undefined)?.skin)
  }
  catch (e) {
    console.error('[skin] fetch shared skin failed', e)
    return null
  }
}

/** 生成「添加皮肤」链接；点开后会弹出浮窗询问是否添加。 */
export function buildSkinShareURL(token: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const normalized = base.endsWith('/') ? base : `${base}/`
  return `${window.location.origin}${normalized}?addSkin=${encodeURIComponent(token)}`
}
