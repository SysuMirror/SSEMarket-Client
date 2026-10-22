import { requestFunc } from '../req'

export interface UserSearchPostCard {
  postID: number
  title: string
  partition: string
  photos: string
  likeNum: number
  browseNum: number
  postTime: string
}

export type UserSearchMatchType = 'name' | 'intro' | 'semantic'

/** 搜索页用户卡片；字段与后端 domain.UserSearchResult 一一对应。 */
export interface UserSearchUser {
  userID: number
  name: string
  avatarURL: string
  identity: string
  intro: string
  score: number
  customTitle: string
  receivedLikeNum: number
  postCount: number
  /** 用户开启了「在个人主页隐藏发帖」；为 true 时 posts 必为空 */
  hidden: boolean
  matchType: UserSearchMatchType
  relevance: number
  posts: UserSearchPostCard[]
}

interface SearchUsersResponse {
  code: number
  data?: {
    users?: UserSearchUser[]
    threshold?: number
  }
  msg?: string
}

/**
 * 按用户名/简介搜索用户，供搜索页顶部的 B 站式用户卡片使用。
 * 失败时静默返回空数组（不打断帖子搜索）。
 */
export async function searchUsers(keyword: string, limit = 3): Promise<UserSearchUser[]> {
  const q = keyword.trim()
  if (!q)
    return []
  try {
    const res = await requestFunc('/auth/search/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { keyword: q, limit },
    }, true)
    if (!res?.ok)
      return []
    const json = await res.json() as SearchUsersResponse
    if (json.code !== 200)
      return []
    return (json.data?.users ?? []).map(user => ({
      ...user,
      posts: user.posts ?? [],
    }))
  }
  catch (e) {
    console.error('search users failed', e)
    return []
  }
}
