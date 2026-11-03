import { reactive, ref } from 'vue'
import { getPosts } from '@/api/browse/getPost'
import { hideSnackbar } from '@/utils/snackbar'
import { useUserStore } from './userStore'

// 新帖子通知状态
const newPostsNotification = reactive({
  isVisible: false,
  newPostIds: [] as number[],
  updatedAt: 0,
})

// 缓存的首页帖子ID列表（最新30个）
const cachedHomePostIds = ref<number[]>([])

// 轮询定时器
let pollingTimer: ReturnType<typeof setInterval> | null = null

// 是否正在轮询新帖子
const isPollingNewPosts = ref(false)

// 「为你推荐」开启后不再提醒新帖：推荐流本身会自动把内容轮换上来。
// recommendationModeOn 来自设置接口；recommendationFeedActive 来自首页实际返回的 feedMode，
// 两者任一成立都暂停轮询并清掉已有提醒。
const recommendationModeOn = ref(false)
const recommendationFeedActive = ref(false)

function shouldSuppressNewPosts(): boolean {
  return recommendationModeOn.value || recommendationFeedActive.value
}

function clearNotification(): void {
  newPostsNotification.isVisible = false
  newPostsNotification.newPostIds.splice(0, newPostsNotification.newPostIds.length)
  newPostsNotification.updatedAt = 0
  cachedHomePostIds.value = []
  hideSnackbar('new-posts-notification')
}

// 获取首页最新帖子ID列表
async function getHomePostIds(): Promise<number[]> {
  const { userInfo } = useUserStore()
  if (!userInfo.phone)
    return []
  try {
    const res = await getPosts({
      limit: 20,
      offset: 0,
      partition: '主页',
      searchsort: 'home',
      searchinfo: '',
      userTelephone: userInfo.phone,
      tag: '',
    })
    return res.posts.map(post => post.PostID)
  }
  catch (error) {
    console.error('获取首页帖子ID失败:', error)
    return []
  }
}

// 检查新帖子
async function checkNewPosts(): Promise<void> {
  if (shouldSuppressNewPosts()) {
    clearNotification()
    return
  }
  if (isPollingNewPosts.value)
    return
  isPollingNewPosts.value = true
  try {
    const currentPostIds = await getHomePostIds()
    if (shouldSuppressNewPosts()) {
      clearNotification()
      return
    }
    if (cachedHomePostIds.value.length === 0) {
      // 首次加载，直接缓存
      cachedHomePostIds.value = currentPostIds
      return
    }
    // 找出新帖子ID
    const newPostIds = currentPostIds.filter(id => !cachedHomePostIds.value.includes(id))
    if (newPostIds.length > 0) {
      // 有新帖子，更新通知状态
      newPostsNotification.newPostIds.push(...newPostIds)
      newPostsNotification.isVisible = true
      newPostsNotification.updatedAt = Date.now()
      // 更新缓存（保持最新20个）
      cachedHomePostIds.value = currentPostIds.slice(0, 20)
    }
  }
  catch (error) {
    console.error('检查新帖子失败:', error)
  }
  finally {
    isPollingNewPosts.value = false
  }
}

// 开始轮询
function startPolling(): void {
  if (shouldSuppressNewPosts()) {
    stopPolling()
    clearNotification()
    return
  }
  if (pollingTimer)
    return
  checkNewPosts()
  pollingTimer = setInterval(() => {
    checkNewPosts()
  }, 60 * 1000) // 每1min获取一次
}

// 停止轮询
function stopPolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

// 隐藏通知
function hideNotification(): void {
  newPostsNotification.isVisible = false
}

// 初始化新帖子缓存（在首页加载完成后调用）
async function initNewPostsCache(): Promise<void> {
  if (shouldSuppressNewPosts()) {
    clearNotification()
    return
  }
  const postIds = await getHomePostIds()
  if (shouldSuppressNewPosts()) {
    clearNotification()
    return
  }
  cachedHomePostIds.value = postIds
}

/**
 * 设置页/布局拿到推荐设置后调用。
 * 开启「为你推荐」（含灰度生效）时立即停止新帖轮询并清掉提醒。
 */
function setRecommendationModeEnabled(enabled: boolean): void {
  recommendationModeOn.value = enabled
  if (enabled)
    clearNotification()
  syncPolling()
}

/** 首页实际 feedMode 变化时调用；推荐流生效时同样不再提醒新帖。 */
function setRecommendationFeedActive(active: boolean): void {
  recommendationFeedActive.value = active
  if (active)
    clearNotification()
  syncPolling()
}

function syncPolling(): void {
  if (shouldSuppressNewPosts())
    stopPolling()
  else
    startPolling()
}

// 访问新帖子后，从新帖子列表中移除对应的新帖子ID
function removeNewPostId(postId: number): void {
  const index = newPostsNotification.newPostIds.indexOf(postId)
  if (index > -1) {
    newPostsNotification.newPostIds.splice(index, 1)
    newPostsNotification.updatedAt = Date.now()
  }
}

export function useNewPostsStore() {
  return {
    newPostsNotification,
    isPollingNewPosts,

    startPolling,
    stopPolling,
    checkNewPosts,
    hideNotification,
    initNewPostsCache,
    removeNewPostId,
    setRecommendationModeEnabled,
    setRecommendationFeedActive,
  }
}
