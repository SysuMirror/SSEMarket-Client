import { useUserStore } from '@/store/userStore'
import { requestFunc } from '../req'

/**
 * 全站皮肤接口。
 *
 * GET  /auth/theme/state    活动时间窗 + 当前用户设置（游客可读）
 * POST /auth/theme/settings 保存当前用户设置
 *
 * 时间窗以后端为准（北京时间 10.24 当天）；前端只负责按 themeMode 组合：
 * - auto：活动期间用活动皮肤，结束自动回默认；
 * - default：强制默认；
 * - <skinID>：强制使用该皮肤（活动结束后也可手动保留）。
 */

const apiUrl = import.meta.env.VITE_API_BASE_URL

export type ThemeMode = 'auto' | 'default' | (string & {})
export type ThemeBackgroundSource = 'default' | 'custom'

export interface ThemeEvent {
  themeId: string
  name: string
  active: boolean
  startsAt: string
  endsAt: string
  serverTime: string
}

export interface ThemeSettings {
  themeMode: ThemeMode
  splashEnabled: boolean
  backgroundEnabled: boolean
  backgroundSource: ThemeBackgroundSource
  customBackgroundUrl: string
  updatedAt?: string
}

export interface ThemeState {
  serverTime: string
  event: ThemeEvent
  /** 游客为 null；登录用户没有保存过时后端返回默认值（非 null）。 */
  settings: ThemeSettings | null
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  themeMode: 'auto',
  splashEnabled: true,
  backgroundEnabled: true,
  backgroundSource: 'default',
  customBackgroundUrl: '',
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

export function normalizeThemeSettings(raw: unknown): ThemeSettings {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const source = text(d.backgroundSource, DEFAULT_THEME_SETTINGS.backgroundSource)
  return {
    themeMode: text(d.themeMode, DEFAULT_THEME_SETTINGS.themeMode),
    splashEnabled: bool(d.splashEnabled, DEFAULT_THEME_SETTINGS.splashEnabled),
    backgroundEnabled: bool(d.backgroundEnabled, DEFAULT_THEME_SETTINGS.backgroundEnabled),
    backgroundSource: source === 'custom' ? 'custom' : 'default',
    customBackgroundUrl: text(d.customBackgroundUrl, ''),
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : undefined,
  }
}

function normalizeEvent(raw: unknown): ThemeEvent | null {
  if (!raw || typeof raw !== 'object')
    return null
  const d = raw as Record<string, unknown>
  const themeId = text(d.themeId, '')
  const startsAt = text(d.startsAt, '')
  const endsAt = text(d.endsAt, '')
  if (!themeId || !startsAt || !endsAt)
    return null
  return {
    themeId,
    name: text(d.name, themeId),
    active: bool(d.active, false),
    startsAt,
    endsAt,
    serverTime: text(d.serverTime, ''),
  }
}

/**
 * 拉取活动时间窗。带 token 时后端会一并返回该用户的外观设置。
 * 失败返回 null（页面继续用本地默认值/缓存，不阻塞进入站点）。
 */
export async function fetchThemeState(): Promise<ThemeState | null> {
  try {
    const token = useUserStore().token.value
    const res = await fetch(`${apiUrl}/auth/theme/state`, {
      method: 'GET',
      // 带用户设置，绝不能走 CDN/浏览器缓存
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok)
      return null
    const json = await res.json() as { data?: Record<string, unknown> }
    const data = json?.data
    if (!data)
      return null
    const event = normalizeEvent(data.event)
    if (!event)
      return null
    return {
      serverTime: text(data.serverTime, event.serverTime),
      event,
      settings: data.settings == null ? null : normalizeThemeSettings(data.settings),
    }
  }
  catch (e) {
    console.error('[theme] fetch state failed', e)
    return null
  }
}

export interface SaveThemeSettingsResult {
  ok: boolean
  msg: string
  settings: ThemeSettings | null
}

/** 保存外观设置。必须登录；失败时返回后端 msg，调用方负责提示并回滚。 */
export async function saveThemeSettings(settings: ThemeSettings): Promise<SaveThemeSettingsResult> {
  try {
    const res = await requestFunc('/auth/theme/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        themeMode: settings.themeMode,
        splashEnabled: settings.splashEnabled,
        backgroundEnabled: settings.backgroundEnabled,
        backgroundSource: settings.backgroundSource,
        customBackgroundUrl: settings.customBackgroundUrl,
      },
    }, true)
    if (!res)
      return { ok: false, msg: '登录状态已失效，请重新登录', settings: null }
    const json = await res.json() as { code?: number, msg?: string, data?: { settings?: unknown } }
    if (json.code !== 200)
      return { ok: false, msg: json.msg || '保存失败', settings: null }
    return {
      ok: true,
      msg: json.msg || '已保存',
      settings: json.data?.settings ? normalizeThemeSettings(json.data.settings) : null,
    }
  }
  catch (e) {
    console.error('[theme] save settings failed', e)
    return { ok: false, msg: '网络异常，请稍后重试', settings: null }
  }
}
