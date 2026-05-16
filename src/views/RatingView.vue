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
import { usePostStore } from '@/store/postStore'
import { useUserStore } from '@/store/userStore'
import { getWindowScrollY, setWindowScrollY } from '@/utils/windowScroll'

defineOptions({
  name: 'RatingView',
})

const route = useRoute()
const { userInfo } = useUserStore()
const { restorePosts, storePosts } = usePostStore()
const { posts, update, isLoading, hasMore, initialize } = usePostView()

const isDense = ref(true)

const scrollTop = ref(0)
const hasCache = ref(false)
const cachePosts = reactive<Post[]>([])
const cacheTotalNum = ref(0)
const cacheCondition = reactive<Condition>({
  limit: 10,
  offset: 0,
  partition: '打分',
  searchsort: 'rating',
  searchinfo: '',
  tag: '',
})

onMounted(async () => {
  await initialize('打分')
  hasCache.value = true
})

onActivated(async () => {
  if (!hasCache.value)
    return

  isLoading.value = true
  await restorePosts(userInfo.phone, cachePosts, cacheTotalNum.value, cacheCondition)
  isLoading.value = false
  await nextTick()
  requestAnimationFrame(() => {
    setWindowScrollY(scrollTop.value)
    requestAnimationFrame(() => setWindowScrollY(scrollTop.value))
  })
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
    await initialize('打分')

    const newQuery = { ...route.query }
    delete newQuery.refresh
    const queryString = Object.keys(newQuery).length > 0 ? `?${new URLSearchParams(newQuery as Record<string, string>).toString()}` : ''
    window.history.replaceState({}, '', `${route.path}${queryString}`)
  }
})
</script>

<template>
  <div class="rating-page">
    <header class="rating-page__head">
      <Icon icon="tabler:star" class="rating-page__head-icon" width="22" height="22" aria-hidden="true" />
      <div>
        <h1 class="rating-page__title">
          打分
        </h1>
        <p class="rating-page__subtitle">
          课程评价与交流
        </p>
      </div>
    </header>

    <div class="rating-page__list">
      <PostList
        :posts="posts"
        post-type="rating"
        :is-dense="isDense"
        :is-loading="isLoading"
        :has-more="hasMore"
        @bottom="update"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.rating-page {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 14px 1.5rem;
  box-sizing: border-box;
  color: var(--chat-text);
}

.rating-page__head {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  margin-bottom: 1rem;
}

.rating-page__head-icon {
  color: var(--chat-accent);
  flex-shrink: 0;
  margin-top: 2px;
}

.rating-page__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--chat-text);
}

.rating-page__subtitle {
  margin: 0.3rem 0 0;
  font-size: 0.875rem;
  color: var(--chat-text-secondary);
}

.rating-page__list {
  width: 100%;
}
</style>
