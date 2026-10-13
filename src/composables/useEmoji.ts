import type { EmojiItem, EmojiPackItem, EmojiSearchData } from '@/api/emoji/emoji'
import { reactive, ref } from 'vue'
import {
  addEmojiFromChat,
  addEmojiPack,
  createEmojiPack,
  deleteEmojiPack,
  deleteEmojiSticker,
  getEmojiPanel,
  removeEmojiPack,
  resolveEmojis,
  searchEmoji,
  uploadEmojiStickers,
} from '@/api/emoji/emoji'

/**
 * 表情面板的共享状态（模块级单例，与 useChat 同一套路）：
 * 面板数据 + 按 emojiID 的渲染缓存。聊天气泡渲染 token 时靠这份缓存取图。
 * 页签模型与微信一致：内置组（小汐/SSE娘）打头，个人表情组「我的表情」默认为空，
 * 添加过的表情包组各占一页。
 */

const panel = reactive<{
  builtinPack: EmojiPackItem | null
  builtinStickers: EmojiItem[]
  personalPack: EmojiPackItem | null
  personalStickers: EmojiItem[]
  packs: EmojiPackItem[]
}>({
  builtinPack: null,
  builtinStickers: [],
  personalPack: null,
  personalStickers: [],
  packs: [],
})

const byID = reactive(new Map<number, EmojiItem>())
const resolving = new Set<number>()
const panelLoaded = ref(false)
const panelLoading = ref(false)

/** 内置表情的 url 字段存裸文件名，资源在前端 public/emoji/ 下；上传表情是图床绝对地址。 */
export function emojiSrc(emoji: EmojiItem): string {
  if (emoji.isBuiltin)
    return `${import.meta.env.BASE_URL}emoji/${encodeURIComponent(emoji.url)}`
  return emoji.url
}

function remember(emoji: EmojiItem | null | undefined) {
  if (emoji?.emojiID)
    byID.set(emoji.emojiID, emoji)
}

function rememberAll(list: EmojiItem[] | undefined) {
  for (const item of list ?? [])
    remember(item)
}

export async function loadEmojiPanel(force = false) {
  if (panelLoading.value || (panelLoaded.value && !force))
    return
  panelLoading.value = true
  try {
    const data = await getEmojiPanel()
    if (!data)
      return
    panel.builtinPack = data.builtinPack ?? null
    panel.builtinStickers = data.builtinPack?.stickers ?? []
    panel.personalPack = data.personalPack ?? null
    panel.personalStickers = data.personalPack?.stickers ?? []
    panel.packs = data.packs ?? []
    rememberAll(panel.builtinStickers)
    rememberAll(panel.personalStickers)
    for (const pack of panel.packs)
      rememberAll(pack.stickers)
    panelLoaded.value = true
  }
  finally {
    panelLoading.value = false
  }
}

/** 气泡渲染遇到缓存里没有的 ID 时按需补拉（已删除的表情后端也会返回，历史消息不裂）。 */
export async function resolveEmojiIDs(ids: number[]) {
  const missing = ids.filter(id => id > 0 && !byID.has(id) && !resolving.has(id))
  if (missing.length === 0)
    return
  for (const id of missing)
    resolving.add(id)
  try {
    const stickers = await resolveEmojis(missing)
    rememberAll(stickers)
  }
  finally {
    for (const id of missing)
      resolving.delete(id)
  }
}

export function getCachedEmoji(emojiID: number): EmojiItem | undefined {
  return byID.get(emojiID)
}

/** 长按聊天里的表情 → 加进个人表情组「我的表情」（后端复制一份归自己，同图幂等）。 */
export async function addEmojiToPersonalPack(emojiID: number) {
  const result = await addEmojiFromChat(emojiID)
  if (result.ok && result.sticker) {
    remember(result.sticker)
    if (!panel.personalStickers.some(item => item.emojiID === result.sticker!.emojiID)) {
      panel.personalStickers.unshift(result.sticker)
      if (panel.personalPack)
        panel.personalPack.stickerCount = panel.personalStickers.length
    }
  }
  return result
}

export async function searchEmojiPacks(keyword: string): Promise<EmojiSearchData | null> {
  return await searchEmoji(keyword)
}

export async function addPackToPanel(packID: number) {
  const result = await addEmojiPack(packID)
  if (result.ok)
    await loadEmojiPanel(true)
  return result
}

export async function removePackFromPanel(packID: number) {
  const result = await removeEmojiPack(packID)
  if (result.ok)
    panel.packs = panel.packs.filter(pack => pack.packID !== packID)
  return result
}

export async function deletePackForever(packID: number) {
  const result = await deleteEmojiPack(packID)
  if (result.ok)
    panel.packs = panel.packs.filter(pack => pack.packID !== packID)
  return result
}

/** 删除自己的一张表情：个人组里的「移出」与分享组里自己上传的「彻底删除」走同一接口（软删除）。 */
export async function deleteSticker(emojiID: number) {
  const result = await deleteEmojiSticker(emojiID)
  if (result.ok) {
    panel.personalStickers = panel.personalStickers.filter(item => item.emojiID !== emojiID)
    if (panel.personalPack)
      panel.personalPack.stickerCount = panel.personalStickers.length
    for (const pack of panel.packs)
      pack.stickers = (pack.stickers ?? []).filter(item => item.emojiID !== emojiID)
  }
  return result
}

export async function uploadStickers(files: File[]) {
  const result = await uploadEmojiStickers(files)
  if (result.ok)
    await loadEmojiPanel(true)
  return result
}

export async function createPack(files: File[], title: string, isPublic: boolean) {
  const result = await createEmojiPack(files, title, isPublic)
  if (result.ok)
    await loadEmojiPanel(true)
  return result
}

export function useEmoji() {
  return {
    panel,
    panelLoaded,
    loadEmojiPanel,
    resolveEmojiIDs,
    getCachedEmoji,
    addEmojiToPersonalPack,
    searchEmojiPacks,
    addPackToPanel,
    removePackFromPanel,
    deletePackForever,
    deleteSticker,
    uploadStickers,
    createPack,
  }
}
