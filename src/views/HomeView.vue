<script setup lang="ts">
import type { Condition } from '@/store/postStore'

import type { Post } from '@/types/post'
import { Icon } from '@iconify/vue'
import {
  nextTick,
  onActivated,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import PostList from '@/components/PostList.vue'
import { usePostView } from '@/composables/usePostView'
import { useNewPostsStore } from '@/store/newPostsStore'
import { usePostStore } from '@/store/postStore'
import { useUserStore } from '@/store/userStore'
import { getWindowScrollY, setWindowScrollY } from '@/utils/windowScroll'

defineOptions({
  name: 'HomeView',
})
const route = useRoute()
const { userInfo } = useUserStore()
const { restorePosts, storePosts } = usePostStore()
const { posts, isLoading, hasMore, update, initialize } = usePostView()
const { initNewPostsCache, newPostsNotification } = useNewPostsStore()
const scrollTop = ref(0)
const hasCache = ref(false)
const cachePosts = reactive<Post[]>([])
const cacheTotalNum = ref(0)
const cacheCondition = reactive<Condition>({
  limit: 10,
  offset: 0,
  partition: '主页',
  searchsort: 'home',
  searchinfo: '',
  tag: '',
})

onMounted(async () => {
  await initialize('主页')
  await initNewPostsCache()
  hasCache.value = true
})

onActivated(async () => {
  if (!hasCache.value)
    return

  if (newPostsNotification.isVisible) {
    await initialize('主页')
    await initNewPostsCache()
  }
  else {
    isLoading.value = true
    await restorePosts(userInfo.phone, cachePosts, cacheTotalNum.value, cacheCondition)
    isLoading.value = false
    await nextTick()
    requestAnimationFrame(() => {
      setWindowScrollY(scrollTop.value)
      requestAnimationFrame(() => setWindowScrollY(scrollTop.value))
    })
  }
})

onBeforeRouteLeave(() => {
  scrollTop.value = getWindowScrollY()
  const data = storePosts()
  cachePosts.splice(0, cachePosts.length, ...data.cachePosts)
  cacheTotalNum.value = data.cacheTotalNum
  Object.assign(cacheCondition, data.cacheConditions)
})

watch(() => route.query.refresh, async (newRefresh) => {
  if (newRefresh && hasCache.value) {
    await initialize('主页')
    await initNewPostsCache()

    const newQuery = { ...route.query }
    delete newQuery.refresh
    const queryString = Object.keys(newQuery).length > 0 ? `?${new URLSearchParams(newQuery as Record<string, string>).toString()}` : ''
    window.history.replaceState({}, '', `${route.path}${queryString}`)
  }
})
</script>

<template>
  <div class="home-page">
    <header class="home-page__head">
      <div class="home-page__title-row">
        <Icon icon="tabler:home" class="home-page__title-icon" width="22" height="22" aria-hidden="true" />
        <h1 class="home-page__title">
          主页
        </h1>
      </div>
      <p class="home-page__subtitle">
        最新帖子与动态
      </p>
    </header>
    <PostList
      :posts="posts"
      :is-loading="isLoading"
      :has-more="hasMore"
      :new-post-ids="newPostsNotification.newPostIds"
      @bottom="update"
    />
  </div>
</template>

<style scoped lang="scss">
.home-page {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 12px 12px 1rem;
  box-sizing: border-box;
  color: var(--chat-text);
  background: var(--chat-bg-elevated);
  border: 1px solid var(--chat-border);
  border-radius: 18px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.home-page__head {
  margin-bottom: 0.75rem;
}

.home-page__title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.home-page__title-icon {
  color: var(--chat-accent);
  flex-shrink: 0;
}

.home-page__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--chat-text);
}

.home-page__subtitle {
  margin: 0.3rem 0 0;
  font-size: 0.8125rem;
  color: var(--chat-text-secondary);
}
</style>
