import type { Post } from '@/types/post'
import type { UserInfo } from '@/store/userStore'

type PostWithOwnerKeys = Post & { userID?: number, user_id?: number }

/** 判断当前用户是否为帖子作者（仅 userID） */
export function isPostOwner(
  post: PostWithOwnerKeys,
  user: Pick<UserInfo, 'userID'>,
): boolean {
  const ownerId = Number(post.UserID ?? post.userID ?? post.user_id ?? 0)
  return ownerId > 0 && user.userID > 0 && ownerId === user.userID
}

/** 统一解析后端帖子字段（兼容 isPrivate / IsPrivate） */
export function normalizePost(raw: Record<string, unknown>): Post {
  const p = raw as unknown as Post
  return {
    ...p,
    UserID: Number(raw.UserID ?? raw.userID ?? p.UserID ?? 0) || undefined,
    IsPrivate: Boolean(raw.IsPrivate ?? raw.isPrivate ?? p.IsPrivate),
  }
}

export function normalizePosts(list: unknown[]): Post[] {
  if (!Array.isArray(list))
    return []
  return list.map(item => normalizePost(item as Record<string, unknown>))
}
