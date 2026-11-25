import type { Post } from '@/types/post'

import { reactive, ref, unref } from 'vue'

import { getPosts, getPostsNum } from '@/api/browse/getPost'
import { CONTENT_PARTITIONS } from '@/constants/partitions'

// 精华帖=虚拟分区（后端 is_high_quality 过滤，不占内容分区导航），主页「只看精华」开关走这里
export const Partitions = ['主页', '收藏', '历史', '精华帖', ...CONTENT_PARTITIONS.map(p => p.name)] as const
export const SearchSort = ['home', 'save', 'history'] as const

export type HomeOrderBy
  = | 'time_desc'
  | 'time_asc'
  | 'like_desc'
  | 'like_asc'
  | 'comment_desc'
  | 'comment_asc'

export interface Condition {
  limit: number
  offset: number
  partition: typeof Partitions[number]
  searchsort: typeof SearchSort[number]
  searchinfo: string
  tag: string
  orderBy: HomeOrderBy
  timeFrom: string
  timeTo: string
}

/** 瀑布流每页条数（与后端 browse 默认 15 对齐） */
export const FEED_PAGE_SIZE = 15

const totalNum = ref(0)

const posts = reactive<Post[]>([])

// 置顶帖数组:仅主页列表时由后端填充。其他场景为空。
// 渲染时由调用方拼接 [...pinnedPosts, ...posts]。
const pinnedPosts = reactive<Post[]>([])

// 当前列表实际推流模式（后端返回）：time=按时间，recommend=为你推荐。
// 推荐流下 posts 不再按 PostID 倒序，一些依赖有序性的查找/插入需要降级处理。
const feedMode = ref<'time' | 'recommend'>('time')

const conditions = reactive<Condition>({
  limit: FEED_PAGE_SIZE,
  offset: 0,
  partition: '主页',
  searchsort: 'home',
  searchinfo: '',
  tag: '',
  orderBy: 'time_desc',
  timeFrom: '',
  timeTo: '',
})

/**
 * 加载下一页帖子(append 到 posts)。
 * 主页场景下后端会同时返回 pinned,但已加载过的不重复填充,
 * 仅在 offset=0(首页)时填充 pinnedPosts。
 *
 * @param userTelephone 用户手机号
 * @returns 是否还有更多帖子
 */
async function addPost(userTelephone: string): Promise<boolean> {
  const data = await getPosts({
    ...conditions,
    userTelephone,
  })
  if (!data || data.posts.length === 0)
    return false
  // 仅首页加载时填充置顶帖。后续翻页后端也会返回同样的 pinned,
  // 但前端只展示一次,避免重复。
  if (conditions.offset === 0 && data.pinned.length > 0) {
    pinnedPosts.splice(0, pinnedPosts.length, ...data.pinned)
  }
  feedMode.value = data.feedMode === 'recommend' ? 'recommend' : 'time'
  posts.push(...data.posts)
  conditions.offset += data.posts.length
  return data.posts.length >= conditions.limit
}

/**
 * 单独刷新主页置顶帖列表。
 * 用于"取消置顶"操作后局部刷新,避免整页重新加载。
 *
 * 只在主页场景下生效;其他场景直接清空 pinnedPosts。
 */
async function refreshPinned(userTelephone: string) {
  // 非主页场景没有置顶概念。
  if (conditions.searchsort !== 'home') {
    pinnedPosts.splice(0, pinnedPosts.length)
    return
  }
  // 借首页查询(offset=0,limit=1)仅取 pinned 部分。
  const oldLimit = conditions.limit
  const oldOffset = conditions.offset
  conditions.limit = 1
  conditions.offset = 0
  try {
    const data = await getPosts({ ...conditions, userTelephone })
    if (data && data.pinned.length > 0) {
      pinnedPosts.splice(0, pinnedPosts.length, ...data.pinned)
    }
    else {
      pinnedPosts.splice(0, pinnedPosts.length)
    }
  }
  finally {
    conditions.limit = oldLimit
    conditions.offset = oldOffset
  }
}

async function restorePosts(userTelephone: string, cachePosts: Post[], cacheTotalNum: number, cacheConditions: typeof conditions, cachePinnedPosts?: Post[]) {
  cachePosts = unref(cachePosts)
  cacheTotalNum = unref(cacheTotalNum)
  cacheConditions = { ...unref(cacheConditions) }
  posts.splice(0, posts.length, ...cachePosts)
  // 置顶帖列表也参与缓存恢复,若有传入则使用,否则清空。
  if (cachePinnedPosts && cachePinnedPosts.length > 0) {
    pinnedPosts.splice(0, pinnedPosts.length, ...unref(cachePinnedPosts))
  }
  else {
    pinnedPosts.splice(0, pinnedPosts.length)
  }
  totalNum.value = cacheTotalNum
  conditions.limit = cacheConditions.limit
  conditions.offset = cacheConditions.offset
  conditions.partition = cacheConditions.partition
  conditions.searchsort = cacheConditions.searchsort
  conditions.searchinfo = cacheConditions.searchinfo
  conditions.tag = cacheConditions.tag
  conditions.orderBy = cacheConditions.orderBy || 'time_desc'
  conditions.timeFrom = cacheConditions.timeFrom || ''
  conditions.timeTo = cacheConditions.timeTo || ''
  await getNewPosts(userTelephone)
}

function storePosts() {
  const cachePosts = unref(posts)
  const cacheTotalNum = unref(totalNum)
  const cacheConditions = { ...unref(conditions) }
  const cachePinnedPosts = unref(pinnedPosts)
  return { cachePosts, cacheTotalNum, cacheConditions, cachePinnedPosts }
}

/** 在列表外（如个人主页）持有的帖子对象上同步点赞/收藏状态 */
export function applyPostMutation(
  post: Pick<Post, 'IsLiked' | 'Like' | 'IsSaved' | 'IsPrivate'>,
  type: 'like' | 'save' | 'privacy',
  isPrivate?: boolean,
) {
  switch (type) {
    case 'like':
      post.IsLiked = !post.IsLiked
      post.Like += post.IsLiked ? 1 : -1
      break
    case 'save':
      post.IsSaved = !post.IsSaved
      break
    case 'privacy':
      post.IsPrivate = isPrivate ?? !post.IsPrivate
      break
  }
}

// 查找帖子在数组中的下标(posts 或 pinnedPosts 都查)。
// posts 数组按 PostID 倒序,使用二分查找;pinnedPosts 一般 ≤5 个,线性扫描。
function findPostIndex(id: number): { arr: Post[], index: number } {
  // pinnedPosts 线性扫描(数量少,且按 pinned_at 排序,PostID 无序)
  for (let i = 0; i < pinnedPosts.length; i++) {
    if (pinnedPosts[i].PostID === id)
      return { arr: pinnedPosts, index: i }
  }
  // 推荐流不保证 PostID 有序，退回线性扫描；时间流仍用二分查找。
  if (feedMode.value === 'recommend') {
    const index = posts.findIndex(p => p.PostID === id)
    return { arr: posts, index }
  }
  // posts 二分查找(按 PostID 倒序)
  let left = 0
  let right = posts.length - 1
  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (posts[mid].PostID === id)
      return { arr: posts, index: mid }
    else if (posts[mid].PostID < id)
      right = mid - 1
    else
      left = mid + 1
  }
  return { arr: posts, index: -1 }
}

function updatePost(id: number, type: 'like' | 'save' | 'delete' | 'comment' | 'privacy', isPrivate?: boolean, isSaved?: boolean): boolean {
  const { arr, index } = findPostIndex(id)
  const post = arr[index]
  if (!post)
    return false
  switch (type) {
    case 'like':
      applyPostMutation(post, 'like')
      break
    case 'save': {
      if (typeof isSaved === 'boolean')
        post.IsSaved = isSaved
      else
        applyPostMutation(post, 'save')
      if (conditions.searchsort === 'save' && !post.IsSaved) {
        // 删除时若在 pinnedPosts 中(置顶帖不会出现在收藏列表,但保险起见两处都检查)
        if (arr === pinnedPosts) {
          pinnedPosts.splice(index, 1)
        }
        else {
          posts.splice(index, 1)
          conditions.offset = Math.max(0, conditions.offset - 1)
          totalNum.value = Math.max(0, totalNum.value - 1)
        }
      }
      break
    }
    case 'privacy':
      applyPostMutation(post, 'privacy', isPrivate)
      break
    case 'delete':
      if (arr === pinnedPosts) {
        pinnedPosts.splice(index, 1)
      }
      else {
        posts.splice(index, 1)
        conditions.offset--
        totalNum.value--
      }
      break
  }
  return true
}

async function updateNum(userTelephone: string) {
  const num = await getPostsNum({ ...conditions, userTelephone })
  totalNum.value = num
}

async function getNewPosts(userTelephone: string) {
  const num = await getPostsNum({ ...conditions, userTelephone })
  if (num <= totalNum.value)
    return
  const oldOffset = conditions.offset
  const oldLimit = conditions.limit
  conditions.offset = 0
  conditions.limit = num - totalNum.value
  getPosts({ ...conditions, userTelephone }).then((res) => {
    if (!res || res.posts.length === 0)
      return
    posts.unshift(...res.posts)
  })
  conditions.offset = oldOffset + (num - totalNum.value)
  conditions.limit = oldLimit
  totalNum.value = num
}

function refreshPosts() {
  posts.splice(0, posts.length)
  pinnedPosts.splice(0, pinnedPosts.length)
  feedMode.value = 'time'
  totalNum.value = 0
  conditions.offset = 0
  conditions.partition = '主页'
  conditions.searchinfo = ''
  conditions.searchsort = 'home'
  conditions.tag = ''
  conditions.orderBy = 'time_desc'
}

function setHomeOrder(orderBy: HomeOrderBy) {
  if (conditions.orderBy === orderBy)
    return false
  conditions.orderBy = orderBy
  posts.splice(0, posts.length)
  pinnedPosts.splice(0, pinnedPosts.length)
  conditions.offset = 0
  totalNum.value = 0
  return true
}

function changeTo(p: typeof Partitions[number], tag: string = '') {
  switch (p) {
    case '主页':
      conditions.partition = '主页'
      conditions.searchinfo = ''
      conditions.searchsort = 'home'
      conditions.tag = tag
      break
    case '收藏':
      conditions.partition = '收藏'
      conditions.searchinfo = ''
      conditions.searchsort = 'save'
      conditions.tag = tag
      // 收藏列表不展示置顶帖,清空
      pinnedPosts.splice(0, pinnedPosts.length)
      break
    case '历史':
      conditions.partition = '历史'
      conditions.searchinfo = ''
      conditions.searchsort = 'history'
      conditions.tag = tag
      // 历史列表不展示置顶帖,清空
      pinnedPosts.splice(0, pinnedPosts.length)
      break
    default:
      conditions.partition = p
      conditions.searchinfo = ''
      conditions.searchsort = 'home'
      conditions.tag = tag
      break
  }
}

function search(sinfo: string, p?: typeof Partitions[number]) {
  conditions.searchinfo = sinfo
  conditions.timeFrom = ''
  conditions.timeTo = ''
  if (p) {
    conditions.partition = p
  }
}

function setSearchTimeRange(timeFrom: string, timeTo: string) {
  conditions.timeFrom = timeFrom.trim()
  conditions.timeTo = timeTo.trim()
}

export function usePostStore() {
  return {
    updateNum,
    posts,
    pinnedPosts,
    feedMode,
    restorePosts,
    storePosts,
    addPost,
    updatePost,
    refreshPinned,
    changeTo,
    refreshPosts,
    search,
    setSearchTimeRange,
    setHomeOrder,
    conditions,
    totalNum,
  }
}
