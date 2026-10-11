import type {
  NovelChapterAdjacentItem,
  NovelChapterDetail,
  NovelChapterItem,
} from './types'
import { novelPostJSON, num, str } from './request'

function normalizeChapter(raw: Record<string, unknown>): NovelChapterItem {
  return {
    chapterID: num(raw.chapterID ?? raw.ChapterID),
    novelID: num(raw.novelID ?? raw.NovelID),
    chapterNum: num(raw.chapterNum ?? raw.ChapterNum),
    title: str(raw.title ?? raw.Title),
    wordNum: num(raw.wordNum ?? raw.WordNum),
    commentNum: num(raw.commentNum ?? raw.CommentNum),
    readNum: num(raw.readNum ?? raw.ReadNum),
    createdAt: str(raw.createdAt ?? raw.CreatedAt),
  }
}

function normalizeAdjacent(raw: unknown): NovelChapterAdjacentItem | null {
  if (!raw || typeof raw !== 'object')
    return null
  const r = raw as Record<string, unknown>
  return {
    chapterID: num(r.chapterID ?? r.ChapterID),
    chapterNum: num(r.chapterNum ?? r.ChapterNum),
    title: str(r.title ?? r.Title),
  }
}

export async function getNovelChapters(
  novelID: number,
  limit = 200,
  offset = 0,
): Promise<{ chapters: NovelChapterItem[], total: number }> {
  const data = await novelPostJSON('/auth/novel/chapters', { novelID, limit, offset })
  const list = Array.isArray(data?.chapters) ? data.chapters as Record<string, unknown>[] : []
  return { chapters: list.map(normalizeChapter), total: num(data?.total) }
}

/** 阅读页数据：正文分段（序号与后端段评序号一致）+ 上下章 + 作者有话说。 */
export async function getNovelChapter(chapterID: number): Promise<NovelChapterDetail | null> {
  const data = await novelPostJSON('/auth/novel/chapter', { chapterID })
  if (!data)
    return null
  const rawChapter = (data.chapter ?? {}) as Record<string, unknown>
  const paragraphs = Array.isArray(data.paragraphs) ? data.paragraphs as Record<string, unknown>[] : []
  return {
    chapter: normalizeChapter(rawChapter),
    novelID: num(data.novelID ?? rawChapter.novelID),
    novelTitle: str(data.novelTitle ?? data.NovelTitle),
    authorName: str(data.authorName ?? data.AuthorName),
    paragraphs: paragraphs.map(p => ({
      index: num(p.index ?? p.Index),
      text: str(p.text ?? p.Text),
      commentNum: num(p.commentNum ?? p.CommentNum),
    })),
    authorNote: str(data.authorNote ?? data.AuthorNote),
    prev: normalizeAdjacent(data.prev ?? data.Prev),
    next: normalizeAdjacent(data.next ?? data.Next),
    onShelf: Boolean(data.onShelf ?? data.OnShelf),
    progressPercent: num(data.progressPercent ?? data.ProgressPercent),
  }
}

export async function createNovelChapter(body: {
  novelID: number
  title: string
  content: string
  authorNote?: string
}): Promise<NovelChapterItem | null> {
  const data = await novelPostJSON('/auth/novel/chapter/create', body)
  if (!data || !data.chapterID)
    return null
  return normalizeChapter(data)
}

export async function deleteNovelChapter(chapterID: number): Promise<boolean> {
  return await novelPostJSON('/auth/novel/chapter/delete', { chapterID }) != null
}

/** 上报阅读进度（段落序号 + 百分比），后端按「只前进不倒退」合并。 */
export async function reportNovelProgress(body: {
  novelID: number
  chapterID: number
  paragraphIndex: number
  percent: number
}): Promise<boolean> {
  return await novelPostJSON('/auth/novel/progress/report', body) != null
}
