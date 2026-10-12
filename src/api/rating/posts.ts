import type { RatingPostDetail, RatingPostItem } from './types'
import { requestFunc } from '../req'

export interface RatingListQuery {
  categoryID?: number
  searchinfo?: string
  limit?: number
  offset?: number
}

export async function getRatingPosts(query: RatingListQuery = {}): Promise<RatingPostItem[]> {
  try {
    const res = await requestFunc('/auth/rating/post/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        categoryID: query.categoryID ?? 0,
        searchinfo: query.searchinfo ?? '',
        limit: query.limit ?? 15,
        offset: query.offset ?? 0,
      },
    }, true)
    if (!res?.ok)
      return []
    const raw = await res.json() as Record<string, unknown>[]
    return raw.map(normalizeRatingPostItem)
  }
  catch (e) {
    console.error(e)
    return []
  }
}

export async function getRatingPostCount(query: RatingListQuery = {}): Promise<number> {
  try {
    const res = await requestFunc('/auth/rating/post/count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        categoryID: query.categoryID ?? 0,
        searchinfo: query.searchinfo ?? '',
      },
    }, true)
    if (!res?.ok)
      return 0
    const data = await res.json() as { count?: number }
    return data.count ?? 0
  }
  catch (e) {
    console.error(e)
    return 0
  }
}

export async function getRatingPostDetail(ratingPostID: number): Promise<RatingPostDetail | null> {
  try {
    const res = await requestFunc('/auth/rating/post/detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { ratingPostID },
    }, true)
    if (!res?.ok)
      return null
    const raw = await res.json() as Record<string, unknown>
    return normalizeRatingPostDetail(raw)
  }
  catch (e) {
    console.error(e)
    return null
  }
}

export async function createRatingPost(body: {
  categoryID: number
  title: string
  content: string
  photos?: string
}): Promise<number | null> {
  try {
    const res = await requestFunc('/auth/rating/post/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }, true)
    if (!res?.ok)
      return null
    const data = await res.json() as { ratingPostID?: number }
    return data.ratingPostID ?? null
  }
  catch (e) {
    console.error(e)
    return null
  }
}

export async function deleteRatingPost(ratingPostID: number): Promise<boolean> {
  try {
    const res = await requestFunc('/auth/rating/post/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { ratingPostID },
    }, true)
    return !!res?.ok
  }
  catch (e) {
    console.error(e)
    return false
  }
}

export async function likeRatingPost(ratingPostID: number): Promise<boolean> {
  try {
    const res = await requestFunc('/auth/rating/post/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { ratingPostID },
    }, true)
    return !!res?.ok
  }
  catch (e) {
    console.error(e)
    return false
  }
}

function normalizeRatingPostItem(raw: Record<string, unknown>): RatingPostItem {
  const stars = raw.stars ?? raw.Stars
  const starArr = Array.isArray(stars) && stars.length === 5
    ? stars as [number, number, number, number, number]
    : [0, 0, 0, 0, 0] as [number, number, number, number, number]
  return {
    ratingPostID: Number(raw.ratingPostID ?? raw.RatingPostID ?? 0),
    categoryID: Number(raw.categoryID ?? raw.CategoryID ?? 0),
    categoryName: String(raw.categoryName ?? raw.CategoryName ?? ''),
    userID: Number(raw.userID ?? raw.UserID ?? 0),
    userName: String(raw.userName ?? raw.UserName ?? ''),
    userScore: Number(raw.userScore ?? raw.UserScore ?? 0),
    userTitle: String(raw.userTitle ?? raw.UserTitle ?? ''),
    userTelephone: String(raw.userTelephone ?? raw.UserTelephone ?? ''),
    userAvatar: String(raw.userAvatar ?? raw.UserAvatar ?? ''),
    userIdentity: String(raw.userIdentity ?? raw.UserIdentity ?? ''),
    title: String(raw.title ?? raw.Title ?? ''),
    content: String(raw.content ?? raw.Content ?? ''),
    like: Number(raw.like ?? raw.Like ?? 0),
    comment: Number(raw.comment ?? raw.Comment ?? 0),
    browse: Number(raw.browse ?? raw.Browse ?? 0),
    createdAt: String(raw.createdAt ?? raw.CreatedAt ?? ''),
    isLiked: Boolean(raw.isLiked ?? raw.IsLiked),
    photos: String(raw.photos ?? raw.Photos ?? ''),
    averageRating: Number(raw.averageRating ?? raw.AverageRating ?? 0),
    stars: starArr,
    raterCount: Number(raw.raterCount ?? raw.RaterCount ?? 0),
  }
}

function normalizeRatingPostDetail(raw: Record<string, unknown>): RatingPostDetail {
  const base = normalizeRatingPostItem(raw)
  return {
    ...base,
    userStar: Number(raw.userStar ?? raw.UserStar ?? 0),
  }
}
