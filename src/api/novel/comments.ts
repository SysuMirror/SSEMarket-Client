import type { NovelCommentItem, NovelCommentQuery, NovelTargetType } from './types'
import { novelPostJSON, novelPostRaw } from './request'

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function str(v: unknown): string {
  return v == null ? '' : String(v)
}

export function normalizeNovelComment(raw: Record<string, unknown>): NovelCommentItem {
  return {
    commentID: num(raw.commentID ?? raw.CommentID),
    novelID: num(raw.novelID ?? raw.NovelID),
    chapterID: num(raw.chapterID ?? raw.ChapterID),
    paragraphIndex: num(raw.paragraphIndex ?? raw.ParagraphIndex),
    targetType: (str(raw.targetType ?? raw.TargetType) || 'book') as NovelTargetType,
    paragraphExcerpt: str(raw.paragraphExcerpt ?? raw.ParagraphExcerpt),
    authorID: num(raw.authorID ?? raw.AuthorID),
    author: str(raw.author ?? raw.Author),
    authorTelephone: str(raw.authorTelephone ?? raw.AuthorTelephone),
    authorScore: num(raw.authorScore ?? raw.AuthorScore),
    authorAvatar: str(raw.authorAvatar ?? raw.AuthorAvatar),
    authorIdentity: str(raw.authorIdentity ?? raw.AuthorIdentity),
    commentTime: str(raw.commentTime ?? raw.CommentTime),
    content: str(raw.content ?? raw.Content),
    isRating: Boolean(raw.isRating ?? raw.IsRating),
    likeNum: num(raw.likeNum ?? raw.LikeNum),
    isLiked: Boolean(raw.isLiked ?? raw.IsLiked),
  }
}

/**
 * 评论列表：
 * targetType=paragraph 时按 chapterID + paragraphIndex 取段评；
 * targetType=chapter 取整章评论；不传 targetType 取整本书评论（书评 + 章评 + 段评）。
 */
export async function getNovelComments(query: NovelCommentQuery): Promise<{ comments: NovelCommentItem[], total: number }> {
  const data = await novelPostJSON('/auth/novel/comment/list', {
    novelID: query.novelID,
    targetType: query.targetType ?? '',
    chapterID: query.chapterID ?? 0,
    paragraphIndex: query.paragraphIndex ?? 0,
    limit: query.limit ?? 50,
    offset: query.offset ?? 0,
  })
  const list = Array.isArray(data?.comments) ? data.comments as Record<string, unknown>[] : []
  return { comments: list.map(normalizeNovelComment), total: num(data?.total) }
}

export async function createNovelComment(body: {
  novelID: number
  targetType: NovelTargetType
  chapterID?: number
  paragraphIndex?: number
  content: string
}): Promise<{ comment: NovelCommentItem | null, msg: string }> {
  const res = await novelPostRaw('/auth/novel/comment/create', body)
  if (!res)
    return { comment: null, msg: '评论失败' }
  if (!res.ok)
    return { comment: null, msg: str(res.data.msg) || '评论失败' }
  return { comment: normalizeNovelComment(res.data), msg: '' }
}

export async function likeNovelComment(commentID: number): Promise<boolean> {
  const data = await novelPostJSON('/auth/novel/comment/like', { commentID })
  return data != null
}

export async function deleteNovelComment(commentID: number): Promise<boolean> {
  const data = await novelPostJSON('/auth/novel/comment/delete', { commentID })
  return data != null
}
