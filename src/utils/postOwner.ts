import type { Post } from '@/types/post'
import type { UserInfo } from '@/store/userStore'

type PostWithOwnerKeys = Post & { userID?: number, user_id?: number, IsOwner?: boolean, isOwner?: boolean }

/** 判断当前用户是否为帖子作者：优先使用后端返回的 IsOwner 字段（匿名帖场景），否则回退到 userID 匹配 */
export function isPostOwner(
  post: PostWithOwnerKeys,
  user: Pick<UserInfo, 'userID'>,
): boolean {
  // 后端已为匿名帖返回 IsOwner 标志（作者信息脱敏但保留归属判断）
  if (typeof post.IsOwner === 'boolean' || typeof post.isOwner === 'boolean')
    return post.IsOwner ?? post.isOwner ?? false
  const ownerId = Number(post.UserID ?? post.userID ?? post.user_id ?? 0)
  return ownerId > 0 && user.userID > 0 && ownerId === user.userID
}

/** 统一解析后端帖子字段（兼容 isPrivate / IsPrivate 等别名） */
export function normalizePost(raw: Record<string, unknown>): Post {
  const p = raw as unknown as Post
  return {
    ...p,
    UserID: Number(raw.UserID ?? raw.userID ?? p.UserID ?? 0) || undefined,
    IsPrivate: Boolean(raw.IsPrivate ?? raw.isPrivate ?? p.IsPrivate),
    IsLottery: Boolean(raw.IsLottery ?? raw.isLottery ?? p.IsLottery),
    IsWatched: Boolean(raw.IsWatched ?? raw.isWatched ?? p.IsWatched),
    IsSaved: Boolean(raw.IsSaved ?? raw.isSaved ?? p.IsSaved),
    IsLiked: Boolean(raw.IsLiked ?? raw.isLiked ?? p.IsLiked),
  }
}

export function normalizePosts(list: unknown[]): Post[] {
  if (!Array.isArray(list))
    return []
  return list.map(item => normalizePost(item as Record<string, unknown>))
}
