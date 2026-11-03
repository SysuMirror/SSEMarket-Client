import type { Condition } from '@/store/postStore'
import type { Post } from '@/types/post'
import type { usePostView } from '@/composables/usePostView'
import {
  nextTick,
  onActivated,
  reactive,
  ref,
} from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { usePostStore } from '@/store/postStore'
import { useUserStore } from '@/store/userStore'
import { getWindowScrollY, setWindowScrollY } from '@/utils/windowScroll'

/**
 * 帖子列表页缓存：配合 <KeepAlive> 使用。
 * 离开列表进详情时快照全局 posts/conditions 与滚动位置，返回时原样恢复，
 * 避免重新挂载后清空列表、跳回顶部。
 * 传入页面自己的 usePostView() 返回值，确保 isLoading/hasMore 与模板共用同一组 ref。
 */
export function usePostListCache(view: ReturnType<typeof usePostView>) {
  const { userInfo } = useUserStore()
  const { restorePosts, storePosts } = usePostStore()
  const { hasMore, isLoading } = view

  const scrollTop = ref(0)
  const hasCache = ref(false)
  const cachePosts = reactive<Post[]>([])
  const cachePinnedPosts = reactive<Post[]>([])
  const cacheTotalNum = ref(0)
  const cacheCondition = reactive<Condition>({
    limit: 10,
    offset: 0,
    partition: '主页',
    searchsort: 'home',
    searchinfo: '',
    tag: '',
    orderBy: 'time_desc',
    timeFrom: '',
    timeTo: '',
  })

  onBeforeRouteLeave(() => {
    scrollTop.value = getWindowScrollY()
    const data = storePosts()
    cachePosts.splice(0, cachePosts.length, ...data.cachePosts)
    cachePinnedPosts.splice(0, cachePinnedPosts.length, ...(data.cachePinnedPosts ?? []))
    cacheTotalNum.value = data.cacheTotalNum
    Object.assign(cacheCondition, data.cacheConditions)
    hasCache.value = true
  })

  onActivated(async () => {
    if (!hasCache.value)
      return
    isLoading.value = true
    await restorePosts(userInfo.phone, cachePosts, cacheTotalNum.value, cacheCondition, cachePinnedPosts)
    hasMore.value = cachePosts.length < cacheTotalNum.value
    isLoading.value = false
    await nextTick()
    requestAnimationFrame(() => {
      setWindowScrollY(scrollTop.value)
      requestAnimationFrame(() => setWindowScrollY(scrollTop.value))
    })
  })

  return { hasCache, scrollTop, cachePosts, cacheTotalNum, cacheCondition }
}
