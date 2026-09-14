import type { BrowseResult, Post } from '@/types/post'
import { normalizePost, normalizePosts } from '@/utils/postOwner'
import { requestFunc } from '../req'

export type HomeOrderBy
  = | 'time_desc'
  | 'time_asc'
  | 'like_desc'
  | 'like_asc'
  | 'comment_desc'
  | 'comment_asc'

export interface getPostsObject {
  limit: number
  offset: number
  partition: string
  searchsort: string
  searchinfo: string
  userTelephone: string
  tag: string
  orderBy?: HomeOrderBy | string
  timeFrom?: string
  timeTo?: string
}

const defaultPost: Post = {
  PostID: 0,
  UserID: 0,
  UserName: '',
  UserScore: 0,
  UserTelephone: '',
  UserAvatar: '',
  UserIdentity: '',
  Title: '',
  Content: '',
  Like: 0,
  Comment: 0,
  Browse: 0,
  Heat: 0,
  PostTime: '',
  IsSaved: false,
  IsLiked: false,
  IsWatched: false,
  IsPrivate: false,
  Photos: '',
  Tag: '',
}

// 空 BrowseResult,用于请求失败时返回(保持调用方结构一致)。
const emptyBrowseResult: BrowseResult = { pinned: [], posts: [], total: 0 }

/**
 * 拉取主页帖子列表。
 *
 * 后端返回 { pinned: [...], posts: [...], total: N }:
 *   - pinned 是当前未过期置顶帖(最多 5,按 PinnedAt DESC)
 *   - posts 是正常分页帖(已排除 pinned 中的 PostID,避免重复)
 *   - total 是正常帖总数(不含 pinned)
 *
 * 注意:旧版后端直接返回数组,新版改为对象结构。前端 store 应分别维护
 * pinned 和 posts 两个数组,渲染时由调用方拼接 [...pinned, ...posts]。
 */
async function getPosts(object: getPostsObject): Promise<BrowseResult> {
  try {
    const res = await requestFunc(
      '/auth/browse',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          ...object,
        },
      },
      true,
    )
    if (!res) {
      console.error('getPosts: 请求失败，未获得响应')
      return emptyBrowseResult
    }

    try {
      const data = await res.json() as Partial<BrowseResult>
      // 兼容性兜底:若后端意外返回数组(老版),整体作为 posts 返回。
      if (Array.isArray(data)) {
        return { pinned: [], posts: normalizePosts(data), total: data.length }
      }
      return {
        pinned: normalizePosts(data.pinned ?? []),
        posts: normalizePosts(data.posts ?? []),
        total: typeof data.total === 'number' ? data.total : 0,
      }
    }
    catch (e) {
      console.error('getPosts: 解析响应失败', e)
      return emptyBrowseResult
    }
  }
  catch (e) {
    console.error(e)
    return emptyBrowseResult
  }
}

/**
 * 给帖子置顶 1 小时。
 * 仅当当前用户有置顶权限时生效(后端校验),否则返回错误。
 */
export async function pinPost(postID: number): Promise<{ ok: boolean, msg?: string }> {
  try {
    const res = await requestFunc('/auth/pinPost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { postID },
    }, true)
    if (!res) {
      return { ok: false, msg: '网络错误' }
    }
    const data = await res.json() as { code?: number, msg?: string }
    if (data.code === 200)
      return { ok: true }
    return { ok: false, msg: data.msg || `code ${data.code}` }
  }
  catch (e) {
    return { ok: false, msg: (e as Error).message }
  }
}

/**
 * 取消帖子置顶。
 */
export async function unpinPost(postID: number): Promise<{ ok: boolean, msg?: string }> {
  try {
    const res = await requestFunc('/auth/unpinPost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { postID },
    }, true)
    if (!res) {
      return { ok: false, msg: '网络错误' }
    }
    const data = await res.json() as { code?: number, msg?: string }
    if (data.code === 200)
      return { ok: true }
    return { ok: false, msg: data.msg || `code ${data.code}` }
  }
  catch (e) {
    return { ok: false, msg: (e as Error).message }
  }
}

export interface getPostsNumObject {
  partition: string
  searchsort: string
  searchinfo: string
  tag: string
  userTelephone: string
  timeFrom?: string
  timeTo?: string
}

export interface getPostsNumResponse {
  Postcount: number
}

/***
 * @description 获取当前分区和搜索条件下的帖子数量，课程专区无论是否有tag都只返回所有数量
 * @param {string} partition 分区
 * @param {string} searchsort home/save/history
 * @param {string} userTelephone
 * @returns {number} 返回帖子数量
 */
async function getPostsNum(object: getPostsNumObject): Promise<number> {
  try {
    const res = await requestFunc(
      `/auth/getPostNum`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          ...object,
        },
      },
      true,
    )
    if (!res) {
      console.error('getPostsNum: 请求失败，未获得响应')
      return -1
    }

    try {
      const data = await res.json()
      return typeof data.Postcount === 'number' ? data.Postcount : -1
    }
    catch (e) {
      console.error('getPostsNum: 解析响应失败', e)
      return -1
    }
  }
  catch (e) {
    console.error(e)
    return -1
  }
}

export interface HeatPost {
  PostID: number
  Title: string
  Heat: number
}

/**
 * @description 获取热门帖子
 * @returns 帖子数组
 */
async function getHeatPosts(): Promise<HeatPost[]> {
  try {
    const res = await requestFunc(
      `/auth/calculateHeat`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      true,
    )
    const data = await res!.json()
    return data
  }
  catch (e) {
    console.error(e)
    return []
  }
}

/***
 * @description 获取帖子详情，可以增加用户浏览量
 * @param {number} PostID 帖子ID
 * @param {string} userTelephone
 * @returns {object} 返回帖子详情
 */
async function getPostByID(
  PostID: number,
  userTelephone: string,
): Promise<Post> {
  try {
    const res = await requestFunc(
      `/auth/showDetails`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          postID: PostID,
          userTelephone,
        },
      },
      true,
    )
    const browseOk = await updateBrowseNum(PostID, userTelephone)
    if (!browseOk) {
      console.error('增加浏览量失败')
    }
    if (!res) {
      return {
        ...defaultPost,
        Title: '网络错误',
        Content: '网络错误',
      }
    }
    try {
      const data = await res.json()
      return normalizePost(data as Record<string, unknown>)
    }
    catch (e) {
      console.error(e)
      return {
        ...defaultPost,
        Title: '帖子不存在',
        Content: '帖子不存在',
      }
    }
  }
  catch (e) {
    console.error(e)
    return {
      ...defaultPost,
      Title: '网络错误',
      Content: '网络错误',
    }
  }
}

async function updateBrowseNum(PostID: number, userTelephone: string) {
  try {
    const res = await requestFunc(
      `/auth/updateBrowseNum`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          postID: PostID,
          userTelephone,
        },
      },
      true,
    )
    return res!.ok
  }
  catch (e) {
    console.error(e)
    return false
  }
}

export { getHeatPosts, getPostByID, getPosts, getPostsNum }
