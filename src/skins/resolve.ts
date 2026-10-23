/**
 * 皮肤解析的纯函数部分（不依赖 Vue / DOM，便于单测）。
 *
 * 时间窗边界与后端 domain/theme.go 保持一致：[startsAt, endsAt)。
 */

export const DEFAULT_THEME_ID = 'default'

export interface SkinEventWindow {
  themeId: string
  startsAt: string
  endsAt: string
}

/** 活动是否进行中；时间解析失败时回退到后端给的 active。 */
export function isThemeWindowActive(
  event: SkinEventWindow | null,
  now: number,
  fallbackActive = false,
): boolean {
  if (!event)
    return false
  const startsAt = Date.parse(event.startsAt)
  const endsAt = Date.parse(event.endsAt)
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt))
    return fallbackActive
  return now >= startsAt && now < endsAt
}

/**
 * 按用户选择和活动状态算出最终皮肤 ID。
 * - auto：活动期间用活动皮肤，否则默认；
 * - default：强制默认；
 * - 其他：用户手动指定，活动结束后也保留。
 */
export function resolveThemeID(
  themeMode: string,
  event: SkinEventWindow | null,
  eventActive: boolean,
): string {
  const mode = themeMode || 'auto'
  if (mode === 'auto')
    return eventActive && event ? event.themeId : DEFAULT_THEME_ID
  if (mode === 'default')
    return DEFAULT_THEME_ID
  return mode
}
