import type { RatingCommentItem } from './types'
import { requestFunc } from '../req'

export async function getRatingComments(ratingPostID: number): Promise<RatingCommentItem[]> {
  try {
    const res = await requestFunc('/auth/rating/comment/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { ratingPostID },
    }, true)
    if (!res?.ok)
      return []
    const raw = await res.json() as Record<string, unknown>[]
    return raw.map(r => ({
      commentID: Number(r.commentID ?? r.CommentID ?? 0),
      authorID: Number(r.authorID ?? r.AuthorID ?? 0),
      author: String(r.author ?? r.Author ?? ''),
      authorTelephone: String(r.authorTelephone ?? r.AuthorTelephone ?? ''),
      authorScore: Number(r.authorScore ?? r.AuthorScore ?? 0),
      authorTitle: String(r.authorTitle ?? r.AuthorTitle ?? ''),
      authorAvatar: String(r.authorAvatar ?? r.AuthorAvatar ?? ''),
      authorIdentity: String(r.authorIdentity ?? r.AuthorIdentity ?? ''),
      commentTime: String(r.commentTime ?? r.CommentTime ?? ''),
      content: String(r.content ?? r.Content ?? ''),
      likeNum: Number(r.likeNum ?? r.LikeNum ?? 0),
      isLiked: Boolean(r.isLiked ?? r.IsLiked),
      authorRating: Number(r.authorRating ?? r.AuthorRating ?? 0),
    }))
  }
  catch (e) {
    console.error(e)
    return []
  }
}

export async function createRatingComment(
  ratingPostID: number,
  content: string,
  starNum: number,
): Promise<boolean> {
  try {
    const res = await requestFunc('/auth/rating/comment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { ratingPostID, content, starNum },
    }, true)
    return !!res?.ok
  }
  catch (e) {
    console.error(e)
    return false
  }
}

export async function likeRatingComment(commentID: number): Promise<boolean> {
  try {
    const res = await requestFunc('/auth/rating/comment/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { commentID },
    }, true)
    return !!res?.ok
  }
  catch (e) {
    console.error(e)
    return false
  }
}
