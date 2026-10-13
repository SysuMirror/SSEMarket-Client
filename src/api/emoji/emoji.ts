import { useUserStore } from '@/store/userStore'
import { requestFunc } from '../req'

/**
 * 表情包体系（参考微信）：
 * - 内置组「小汐（SSE娘）」：后端种子数据（ownerUserID=0），图片资源在前端 public/emoji/，URL 存裸文件名；
 * - 个人表情组「我的表情」：每用户一个（isPersonal），默认空；上传的单张、长按添加的都进这个组；
 * - 表情包组：自己建组（可分享），或搜索别人的公开组并添加。
 * 聊天正文里的表情 token 是 [emoji:<emojiID>]，见 utils/emojiToken。
 */

export interface EmojiItem {
  emojiID: number
  packID: number
  name: string
  url: string
  isBuiltin: boolean
  ownerUserID: number
}

export interface EmojiPackItem {
  packID: number
  title: string
  ownerUserID: number
  isPersonal: boolean
  isPublic: boolean
  coverEmojiID: number
  stickerCount: number
  addedByMe: boolean
  preview: EmojiItem[]
  stickers?: EmojiItem[]
}

export interface EmojiPanelData {
  builtinPack: EmojiPackItem
  personalPack: EmojiPackItem
  packs: EmojiPackItem[]
}

export interface EmojiSearchData {
  stickers: EmojiItem[]
  packs: EmojiPackItem[]
}

const jsonHeaders = { 'Content-Type': 'application/json' }

async function emojiPost(url: string, body: object) {
  const res = await requestFunc(url, { method: 'POST', headers: jsonHeaders, body }, true)
  if (!res)
    return null
  return await res.json() as { code: number, data: any, msg: string }
}

export async function getEmojiPanel(): Promise<EmojiPanelData | null> {
  const resp = await emojiPost('/auth/emoji/panel', {})
  if (resp?.code !== 200)
    return null
  return resp.data as EmojiPanelData
}

export async function searchEmoji(keyword: string): Promise<EmojiSearchData | null> {
  const resp = await emojiPost('/auth/emoji/search', { keyword })
  if (resp?.code !== 200)
    return null
  return resp.data as EmojiSearchData
}

export async function resolveEmojis(ids: number[]): Promise<EmojiItem[]> {
  if (ids.length === 0)
    return []
  const resp = await emojiPost('/auth/emoji/resolve', { ids })
  if (resp?.code !== 200)
    return []
  return (resp.data?.stickers ?? []) as EmojiItem[]
}

/** 长按发出来的表情 → 加进自己的个人表情组。返回 null 时 msg 里是失败原因。 */
export async function addEmojiFromChat(emojiID: number) {
  const resp = await emojiPost('/auth/emoji/addFromChat', { emojiID })
  return {
    ok: resp?.code === 200,
    sticker: (resp?.data?.sticker ?? null) as EmojiItem | null,
    msg: resp?.msg ?? '添加失败',
  }
}

export async function addEmojiPack(packID: number) {
  const resp = await emojiPost('/auth/emoji/pack/add', { packID })
  return { ok: resp?.code === 200, msg: resp?.msg ?? '操作失败' }
}

export async function removeEmojiPack(packID: number) {
  const resp = await emojiPost('/auth/emoji/pack/remove', { packID })
  return { ok: resp?.code === 200, msg: resp?.msg ?? '操作失败' }
}

export async function deleteEmojiPack(packID: number) {
  const resp = await emojiPost('/auth/emoji/pack/delete', { packID })
  return { ok: resp?.code === 200, msg: resp?.msg ?? '操作失败' }
}

/** 删除自己的一张表情（个人组里的移出 / 分享组里自己上传的彻底删除），软删除。 */
export async function deleteEmojiSticker(emojiID: number) {
  const resp = await emojiPost('/auth/emoji/delete', { emojiID })
  return { ok: resp?.code === 200, msg: resp?.msg ?? '操作失败' }
}

async function uploadMultipart(url: string, files: File[], extra: Record<string, string> = {}) {
  const token = useUserStore().token.value
  if (!token)
    return null
  const apiUrl = import.meta.env.VITE_API_BASE_URL
  const formData = new FormData()
  for (const file of files)
    formData.append('files', file, file.name)
  for (const [key, value] of Object.entries(extra))
    formData.append(key, value)
  try {
    const res = await fetch(`${apiUrl}${url}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    return await res.json() as { code: number, data: any, msg: string }
  }
  catch (e) {
    console.error(e)
    return null
  }
}

/** 上传单张 / 多张表情，直接进个人表情组「我的表情」。 */
export async function uploadEmojiStickers(files: File[]) {
  const resp = await uploadMultipart('/auth/emoji/upload', files)
  return {
    ok: resp?.code === 200,
    stickers: (resp?.data?.stickers ?? []) as EmojiItem[],
    msg: resp?.msg ?? '上传失败',
  }
}

/** 上传一组表情并建组；isPublic 决定别人能否搜索并添加。 */
export async function createEmojiPack(files: File[], title: string, isPublic: boolean) {
  const resp = await uploadMultipart('/auth/emoji/pack/create', files, {
    title,
    isPublic: isPublic ? 'true' : 'false',
  })
  return {
    ok: resp?.code === 200,
    pack: (resp?.data?.pack ?? null) as EmojiPackItem | null,
    msg: resp?.msg ?? '创建失败',
  }
}
