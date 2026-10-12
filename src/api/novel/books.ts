import type {
  NovelCategoryItem,
  NovelDetail,
  NovelItem,
  NovelListQuery,
} from './types'
import { useUserStore } from '@/store/userStore'
import { requestFunc } from '../req'
import { novelPostJSON, novelPostRaw, num, str } from './request'

const apiUrl = import.meta.env.VITE_API_BASE_URL

export function normalizeNovelItem(raw: Record<string, unknown>): NovelItem {
  const latestAt = raw.latestChapterAt ?? raw.LatestChapterAt
  return {
    novelID: num(raw.novelID ?? raw.NovelID),
    title: str(raw.title ?? raw.Title),
    authorID: num(raw.authorID ?? raw.AuthorID),
    authorName: str(raw.authorName ?? raw.AuthorName),
    coverURL: str(raw.coverURL ?? raw.CoverURL),
    category: str(raw.category ?? raw.Category),
    intro: str(raw.intro ?? raw.Intro),
    status: str(raw.status ?? raw.Status),
    chapterNum: num(raw.chapterNum ?? raw.ChapterNum),
    wordNum: num(raw.wordNum ?? raw.WordNum),
    readNum: num(raw.readNum ?? raw.ReadNum),
    shelfNum: num(raw.shelfNum ?? raw.ShelfNum),
    commentNum: num(raw.commentNum ?? raw.CommentNum),
    coinNum: num(raw.coinNum ?? raw.CoinNum),
    ratingCount: num(raw.ratingCount ?? raw.RatingCount),
    ratingAvg: num(raw.ratingAvg ?? raw.RatingAvg),
    myCoins: num(raw.myCoins ?? raw.MyCoins),
    myRating: num(raw.myRating ?? raw.MyRating),
    latestChapterID: num(raw.latestChapterID ?? raw.LatestChapterID),
    latestChapterTitle: str(raw.latestChapterTitle ?? raw.LatestChapterTitle),
    latestChapterAt: latestAt ? str(latestAt) : null,
    createdAt: str(raw.createdAt ?? raw.CreatedAt),
    updatedAt: str(raw.updatedAt ?? raw.UpdatedAt),
    onShelf: Boolean(raw.onShelf ?? raw.OnShelf),
    progressPercent: num(raw.progressPercent ?? raw.ProgressPercent),
    progressChapterID: num(raw.progressChapterID ?? raw.ProgressChapterID),
    progressChapterNum: num(raw.progressChapterNum ?? raw.ProgressChapterNum),
  }
}

/** 书列表（发现 / 搜索 / 筛选）。 */
export async function getNovels(query: NovelListQuery = {}): Promise<{ novels: NovelItem[], total: number }> {
  const data = await novelPostJSON('/auth/novel/list', {
    keyword: query.keyword ?? '',
    category: query.category ?? '',
    status: query.status ?? '',
    limit: query.limit ?? 20,
    offset: query.offset ?? 0,
  })
  const list = Array.isArray(data?.novels) ? data.novels as Record<string, unknown>[] : []
  return { novels: list.map(normalizeNovelItem), total: num(data?.total) }
}

/** 我写的书。 */
export async function getMyNovels(query: NovelListQuery = {}): Promise<{ novels: NovelItem[], total: number }> {
  const data = await novelPostJSON('/auth/novel/mine', {
    limit: query.limit ?? 20,
    offset: query.offset ?? 0,
  })
  const list = Array.isArray(data?.novels) ? data.novels as Record<string, unknown>[] : []
  return { novels: list.map(normalizeNovelItem), total: num(data?.total) }
}

/** 我的书架。 */
export async function getShelf(query: NovelListQuery = {}): Promise<{ novels: NovelItem[], total: number }> {
  const data = await novelPostJSON('/auth/novel/shelf/list', {
    limit: query.limit ?? 20,
    offset: query.offset ?? 0,
  })
  const list = Array.isArray(data?.novels) ? data.novels as Record<string, unknown>[] : []
  return { novels: list.map(normalizeNovelItem), total: num(data?.total) }
}

export async function getNovelCategories(): Promise<NovelCategoryItem[]> {
  try {
    const res = await requestFunc('/auth/novel/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {},
    }, true)
    if (!res?.ok)
      return []
    const raw = await res.json() as Record<string, unknown>[]
    if (!Array.isArray(raw))
      return []
    return raw.map(c => ({ name: str(c.name ?? c.Name), count: num(c.count ?? c.Count) }))
  }
  catch (e) {
    console.error(e)
    return []
  }
}

export async function getNovelDetail(novelID: number): Promise<NovelDetail | null> {
  const data = await novelPostJSON('/auth/novel/detail', { novelID })
  if (!data)
    return null
  const item = normalizeNovelItem(data)
  // 评分分布：下标 0 = 5 星；后端缺字段（旧缓存/旧版本）时按全 0 展示
  const rawBars = Array.isArray(data.ratingBars) ? data.ratingBars as unknown[] : []
  const bars = [0, 0, 0, 0, 0] as [number, number, number, number, number]
  for (let i = 0; i < 5; i++)
    bars[i] = num(rawBars[i])
  return {
    ...item,
    ratingBars: bars,
    authorAvatar: str(data.authorAvatar ?? data.AuthorAvatar),
    authorScore: num(data.authorScore ?? data.AuthorScore),
    authorIdentity: str(data.authorIdentity ?? data.AuthorIdentity),
    authorIntro: str(data.authorIntro ?? data.AuthorIntro),
    isAuthor: Boolean(data.isAuthor ?? data.IsAuthor),
  }
}

export interface NovelRatingResult {
  novelID: number
  score: number
  changed: boolean
  firstTime: boolean
  ratingCount: number
  ratingAvg: number
  coins: number
  /** 本次评分是否新建了自动书评（改分只刷新旧书评） */
  commentCreated: boolean
  msg: string
}

/**
 * 给书评分（1–5 星，每人每本一条，可改）。
 * 作者首次收到该读者的评分时 +1 币；评分不给读者任何币或经验。
 */
export async function rateNovel(novelID: number, score: number): Promise<NovelRatingResult | null> {
  const raw = await novelPostRaw('/auth/novel/rate', { novelID, score })
  if (!raw)
    return null
  const d = raw.data ?? {}
  if (!raw.ok) {
    return {
      novelID,
      score: 0,
      changed: false,
      firstTime: false,
      ratingCount: 0,
      ratingAvg: 0,
      coins: 0,
      commentCreated: false,
      msg: str(d.msg) || '评分失败，请稍后重试',
    }
  }
  return {
    novelID: num(d.novelID) || novelID,
    score: num(d.score),
    changed: Boolean(d.changed),
    firstTime: Boolean(d.firstTime),
    ratingCount: num(d.ratingCount),
    ratingAvg: num(d.ratingAvg),
    coins: num(d.coins),
    commentCreated: Boolean(d.commentCreated),
    msg: str(d.msg) || '已评分',
  }
}

export async function createNovel(body: {
  title: string
  authorName?: string
  coverURL?: string
  category?: string
  intro?: string
  status?: string
}): Promise<number | null> {
  const data = await novelPostJSON('/auth/novel/create', body)
  const id = num(data?.novelID ?? data?.NovelID)
  return id > 0 ? id : null
}

/** 改书（作者）：只传要改的字段。成功返回 true，失败返回后端 msg。 */
export async function updateNovel(
  novelID: number,
  patch: {
    title?: string
    coverURL?: string
    category?: string
    intro?: string
    status?: string
  },
): Promise<{ ok: boolean, msg: string }> {
  const body: Record<string, unknown> = { novelID }
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined)
      body[key] = value
  }
  const res = await novelPostRaw('/auth/novel/update', body)
  if (!res)
    return { ok: false, msg: '保存失败，请稍后重试' }
  if (!res.ok)
    return { ok: false, msg: str(res.data.msg) || '保存失败' }
  return { ok: true, msg: str(res.data.msg) || '已更新' }
}

/**
 * 上传图片（书籍封面 / 正文配图），复用主站图床 /auth/uploadPhotos，返回图片 URL。
 * 正文配图插入时会写成 `![](url)` 独立一段，所以这里只负责拿 URL。
 */
export async function uploadNovelImage(file: File): Promise<string | null> {
  const token = useUserStore().token.value
  if (!token)
    return null
  const formData = new FormData()
  formData.append('file', file, file.name)
  try {
    const res = await fetch(`${apiUrl}/auth/uploadPhotos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok)
      return null
    const data = await res.json() as { fileURL?: string }
    return data.fileURL || null
  }
  catch {
    return null
  }
}

export async function deleteNovel(novelID: number): Promise<boolean> {
  return await novelPostJSON('/auth/novel/delete', { novelID }) != null
}

/** 加入书架 / 移出书架，返回切换后的状态。 */
export async function toggleShelf(novelID: number): Promise<{ onShelf: boolean, msg: string } | null> {
  const data = await novelPostJSON('/auth/novel/shelf/toggle', { novelID })
  if (!data)
    return null
  const payload = (data.data ?? {}) as Record<string, unknown>
  return {
    onShelf: Boolean(payload.onShelf ?? payload.OnShelf),
    msg: str(data.msg),
  }
}
