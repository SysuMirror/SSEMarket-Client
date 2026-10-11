import type {
  NovelCategoryItem,
  NovelDetail,
  NovelItem,
  NovelListQuery,
} from './types'
import { requestFunc } from '../req'
import { novelPostJSON, num, str } from './request'

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
  return {
    ...item,
    authorAvatar: str(data.authorAvatar ?? data.AuthorAvatar),
    authorScore: num(data.authorScore ?? data.AuthorScore),
    authorIdentity: str(data.authorIdentity ?? data.AuthorIdentity),
    authorIntro: str(data.authorIntro ?? data.AuthorIntro),
    isAuthor: Boolean(data.isAuthor ?? data.IsAuthor),
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
