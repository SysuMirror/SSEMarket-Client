<script setup lang="ts">
import type { Condition, HomeOrderBy } from '@/store/postStore'

import type { Post } from '@/types/post'
import { Icon } from '@iconify/vue'
import {
  computed,
  nextTick,
  onActivated,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { trackEvia } from '@/analytics/evia'
import PostList from '@/components/PostList.vue'
import PresenceBadge from '@/components/PresenceBadge.vue'
import FestivalBanner from '@/components/skin/FestivalBanner.vue'
import { usePostView } from '@/composables/usePostView'
import { useNewPostsStore } from '@/store/newPostsStore'
import { usePostStore } from '@/store/postStore'
import { useUserStore } from '@/store/userStore'
import { getWindowScrollY, setWindowScrollY } from '@/utils/windowScroll'

defineOptions({
  name: 'HomeView',
})

type SortField = 'time' | 'like' | 'comment' | 'browse'

const route = useRoute()
const router = useRouter()
const { userInfo } = useUserStore()
const { restorePosts, storePosts, setHomeOrder, updateNum } = usePostStore()
const { posts, pinnedPosts, feedMode, isLoading, hasMore, update, initialize, refreshPinned } = usePostView()
const { initNewPostsCache, newPostsNotification, setRecommendationFeedActive } = useNewPostsStore()
const scrollTop = ref(0)
const hasCache = ref(false)
const cachePosts = reactive<Post[]>([])
const cachePinnedPosts = reactive<Post[]>([])
const cacheTotalNum = ref(0)
// 「为你推荐」生效时不用再弹新帖提醒：推荐流本身会轮换内容。
function syncNewPostsMode() {
  setRecommendationFeedActive(feedMode.value === 'recommend')
}
watch(feedMode, (mode) => {
  setRecommendationFeedActive(mode === 'recommend')
}, { immediate: true })

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

// 主页列表渲染数据:置顶帖拼接在普通帖之前。
// pinnedPosts 在非主页场景下由 store 清空,所以拼接结果仍是普通帖。
const allPosts = computed<Post[]>(() => [...pinnedPosts, ...posts])

const sortField = ref<SortField>('time')
const sortDesc = ref(true)

const sortOptions: { field: SortField, label: string, icon: string }[] = [
  { field: 'time', label: '时间', icon: 'tabler:clock' },
  { field: 'like', label: '点赞', icon: 'tabler:heart' },
  { field: 'comment', label: '回复', icon: 'tabler:message' },
  { field: 'browse', label: '浏览', icon: 'tabler:eye' },
]

// 只看精华：切到「精华帖」虚拟分区（后端 is_high_quality 过滤），排序重置为默认
const featuredOnly = ref(false)

async function toggleFeatured() {
  featuredOnly.value = !featuredOnly.value
  trackEvia('feed_sort_changed', {
    source: 'home',
    order_by: 'time_desc',
    featured_only: featuredOnly.value,
  })
  hasMore.value = true
  await initialize(featuredOnly.value ? '精华帖' : '主页')
  syncSortUiFromOrderBy('time_desc')
}

function toOrderBy(field: SortField, desc: boolean): HomeOrderBy {
  const dir = desc ? 'desc' : 'asc'
  if (field === 'time')
    return `time_${dir}` as HomeOrderBy
  if (field === 'like')
    return `like_${dir}` as HomeOrderBy
  if (field === 'browse')
    return `browse_${dir}` as HomeOrderBy
  return `comment_${dir}` as HomeOrderBy
}

function syncSortUiFromOrderBy(orderBy: string) {
  const [field, dir] = orderBy.split('_')
  if (field === 'time' || field === 'like' || field === 'comment' || field === 'browse')
    sortField.value = field
  else
    sortField.value = 'time'
  sortDesc.value = dir !== 'asc'
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
  trackEvia('feed_sort_changed', {
    source: 'home',
    order_by: orderBy,
    featured_only: featuredOnly.value,
  })
  // 切排序后必须重新拉首页；勿在此先置 isLoading=true，
  // 否则 usePostView.update 会因 isLoading 守卫直接 return，列表被清空却不请求。
  hasMore.value = true
  await update()
  await updateNum(userInfo.phone)
}

onMounted(async () => {
  setWindowScrollY(0)
  await initialize('主页')
  syncSortUiFromOrderBy('time_desc')
  syncNewPostsMode()
  await initNewPostsCache()
  hasCache.value = true
})

onActivated(async () => {
  if (!hasCache.value)
    return

  if (newPostsNotification.isVisible) {
    await initialize('主页')
    syncSortUiFromOrderBy('time_desc')
    syncNewPostsMode()
    await initNewPostsCache()
  }
  else {
    isLoading.value = true
    await restorePosts(userInfo.phone, cachePosts, cacheTotalNum.value, cacheCondition, cachePinnedPosts)
    syncSortUiFromOrderBy(cacheCondition.orderBy || 'time_desc')
    featuredOnly.value = cacheCondition.partition === '精华帖'
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
  cachePinnedPosts.splice(0, cachePinnedPosts.length, ...(data.cachePinnedPosts ?? []))
  cacheTotalNum.value = data.cacheTotalNum
  Object.assign(cacheCondition, data.cacheConditions)
})

watch(() => route.query.refresh, async (newRefresh) => {
  if (newRefresh && hasCache.value) {
    await initialize('主页')
    syncSortUiFromOrderBy('time_desc')
    syncNewPostsMode()
    await initNewPostsCache()

    const newQuery = { ...route.query }
    delete newQuery.refresh
    await router.replace({ query: newQuery })
  }
})
</script>

<template>
  <div class="home-page">
    <FestivalBanner />
    <header class="home-page__toolbar" aria-label="主页与排序">
      <div class="home-page__title-row">
        <h1 class="home-page__title">主页</h1>
        <span
          v-if="feedMode === 'recommend' && !featuredOnly"
          class="home-page__rec-badge"
          title="按你的浏览、点赞、评论等兴趣信号排序，可在设置中关闭"
        >
          <Icon icon="tabler:sparkles" width="13" height="13" aria-hidden="true" />
          为你推荐
        </span>
        <PresenceBadge />
      </div>
      <div
        v-if="feedMode !== 'recommend' || featuredOnly"
        class="home-page__sort"
        role="group"
        aria-label="帖子排序"
      >
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
        <button
          type="button"
          class="home-page__sort-btn home-page__featured-btn"
          :class="{ 'home-page__sort-btn--active': featuredOnly }"
          :aria-pressed="featuredOnly"
          @click="toggleFeatured"
        >
          <Icon icon="tabler:star-filled" width="12" height="12" aria-hidden="true" />
          <span>只看精华</span>
        </button>
      </div>
    </header>

    <PostList
      :posts="allPosts"
      :source="featuredOnly ? 'feed_featured' : (feedMode === 'recommend' ? 'feed_recommend' : 'feed_time')"
      :is-loading="isLoading"
      :has-more="hasMore"
      :new-post-ids="newPostsNotification.newPostIds"
      @bottom="update"
      @pin-change="refreshPinned(userInfo.phone)"
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

.home-page__title-row {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
}

.home-page__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
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

.home-page__rec-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  padding: 1px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary, #3b82f6);
  background: color-mix(in srgb, var(--color-primary, #3b82f6) 12%, transparent);
  border-radius: 999px;
}

.home-page__sort {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  flex: 0 0 auto;
}

.home-page__sort-btn {
  display: inline-flex;
  align-items: center;
  flex: none;
  gap: 2px;
  padding: 2px 0;
  font-size: 13px;
  font-weight: 400;
  font-family: inherit;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  white-space: nowrap;
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

.home-page__featured-btn {
  gap: 4px;
  padding-left: 12px;
  border-left: 1px solid var(--color-border, rgba(128, 128, 128, 0.25));
}

/* 窄屏：标题 + 在线人数独占一行，排序选项换到下一行并撑满宽度 */
@media (max-width: 560px) {
  .home-page__sort {
    flex: 1 1 100%;
    justify-content: space-between;
    gap: 8px;
  }
}
</style>
