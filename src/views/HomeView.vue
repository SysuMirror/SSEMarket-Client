<script setup lang="ts">
import type { Condition, HomeOrderBy } from '@/store/postStore'

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

type SortField = 'time' | 'like' | 'comment'

const route = useRoute()
const { userInfo } = useUserStore()
const { restorePosts, storePosts, setHomeOrder, updateNum } = usePostStore()
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
  orderBy: 'time_desc',
  timeFrom: '',
  timeTo: '',
})

const sortField = ref<SortField>('time')
const sortDesc = ref(true)

const sortOptions: { field: SortField, label: string, icon: string }[] = [
  { field: 'time', label: '时间', icon: 'tabler:clock' },
  { field: 'like', label: '点赞', icon: 'tabler:heart' },
  { field: 'comment', label: '回复', icon: 'tabler:message' },
]

function toOrderBy(field: SortField, desc: boolean): HomeOrderBy {
  const dir = desc ? 'desc' : 'asc'
  if (field === 'time')
    return `time_${dir}` as HomeOrderBy
  if (field === 'like')
    return `like_${dir}` as HomeOrderBy
  return `comment_${dir}` as HomeOrderBy
}

async function applySort(field: SortField) {
  if (sortField.value === field) {
    sortDesc.value = !sortDesc.value
  }
  else {
    sortField.value = field
    sortDesc.value = true
  }
  const orderBy = toOrderBy(sortField.value, sortDesc.value)
  if (!setHomeOrder(orderBy))
    return
  hasMore.value = true
  isLoading.value = true
  await update()
  await updateNum(userInfo.phone)
}

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
    hasMore.value = cachePosts.length < cacheTotalNum.value
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
    <header class="home-page__toolbar" aria-label="主页与排序">
      <h1 class="home-page__title">主页</h1>
      <div class="home-page__sort" role="group" aria-label="帖子排序">
        <button
          v-for="opt in sortOptions"
          :key="opt.field"
          type="button"
          class="home-page__sort-btn"
          :class="{ 'home-page__sort-btn--active': sortField === opt.field }"
          @click="applySort(opt.field)"
        >
          <span>{{ opt.label }}</span>
          <Icon
            v-if="sortField === opt.field"
            :icon="sortDesc ? 'tabler:arrow-down' : 'tabler:arrow-up'"
            width="12"
            height="12"
            class="home-page__sort-dir"
            aria-hidden="true"
          />
        </button>
      </div>
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
  padding: 0;
  box-sizing: border-box;
  color: var(--color-text);
}

.home-page__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 14px;
  background: transparent;
}

.home-page__title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text);
  flex-shrink: 0;
}

.home-page__sort {
  display: flex;
  align-items: center;
  gap: 12px;
}

.home-page__sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 0;
  font-size: 13px;
  font-weight: 400;
  font-family: inherit;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.15s ease;

  &:hover {
    color: var(--color-text);
  }

  &--active {
    color: var(--color-text);
    font-weight: 600;
  }
}

.home-page__sort-dir {
  opacity: 0.7;
}
</style>
