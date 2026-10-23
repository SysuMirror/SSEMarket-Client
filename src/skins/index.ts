import type { SkinDefinition } from './types'
import programmersDay2026 from './programmers-day-2026'
import { publicAssetURL } from '@/utils/publicAsset'

export type { SkinDefinition, SkinResponsiveImage, SkinSticker } from './types'

/** 已发布皮肤注册表：新增节日皮肤在这里 add 一行即可。 */
const SKINS: SkinDefinition[] = [
  programmersDay2026,
]

const byID = new Map(SKINS.map(skin => [skin.id, skin]))

/** 供「全部皮肤」列表使用（设置页/以后的主题商店）。 */
export const SKIN_LIST: ReadonlyArray<SkinDefinition> = SKINS

export function getSkin(themeID: string | null | undefined): SkinDefinition | null {
  if (!themeID)
    return null
  return byID.get(themeID) ?? null
}

export function isSkinID(themeID: string): boolean {
  return byID.has(themeID)
}

/** 皮肤资源 URL：public/skins/<skinID>/<file>。 */
export function skinAssetURL(skinID: string, file: string): string {
  return publicAssetURL(`skins/${skinID}/${file.replace(/^\/+/, '')}`)
}

/** 取某套皮肤的贴纸 URL。 */
export function skinStickerURL(skinID: string, file: string): string {
  return skinAssetURL(skinID, file)
}
