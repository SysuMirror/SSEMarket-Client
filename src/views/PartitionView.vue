<script setup lang="ts">
import type { Condition, Partitions } from '@/store/postStore'
import type { Post } from '@/types/post'
import {
  nextTick,
  onActivated,
  onMounted,
  reactive,
  ref,
} from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { showMsg } from '@/components/MessageBox'
import PostList from '@/components/PostList.vue'
import { usePostView } from '@/composables/usePostView'
import { usePostStore } from '@/store/postStore'
import { useUserStore } from '@/store/userStore'
import { getWindowScrollY, setWindowScrollY } from '@/utils/windowScroll'

defineOptions({
  name: 'PartitionView',
})

const name = ref('')
const route = useRoute()
const router = useRouter()
const { userInfo } = useUserStore()
const { restorePosts, storePosts } = usePostStore()
const { posts, update, isLoading, hasMore, initialize } = usePostView()

const isDense = ref(false)

// 保存滚动位置
const scrollTop = ref(0)
const hasCache = ref(false)
const cachePosts = reactive<Post[]>([])
const cacheTotalNum = ref(0)
const cachePartition = ref(route.params.name)
const cacheCondition = reactive<Condition>({
  limit: 10,
  offset: 0,
  partition: cachePartition.value as typeof Partitions[number],
  searchsort: 'home',
  searchinfo: '',
  tag: '',
  orderBy: 'time_desc',
  timeFrom: '',
  timeTo: '',
})

onMounted(async () => {
  setWindowScrollY(0)
  const params = route.params
  if (!('name' in params)) {
    router.push('/')
    showMsg('分区不存在')
    return
  }
  const partition = params.name as typeof Partitions[number]
  if (partition === '课程专区') {
    router.push('/course')
    return
  }
  name.value = partition
  if (!hasCache.value)
    await initialize(partition)
  hasCache.value = true
})

// 组件被激活时
onActivated(async () => {
  if (!hasCache.value)
    return
  isLoading.value = true
  await restorePosts(userInfo.phone, cachePosts, cacheTotalNum.value, cacheCondition)
  hasMore.value = cachePosts.length < cacheTotalNum.value
  isLoading.value = false
  await nextTick()
  requestAnimationFrame(() => {
    setWindowScrollY(scrollTop.value)
    requestAnimationFrame(() => setWindowScrollY(scrollTop.value))
  })
})

onBeforeRouteUpdate(async () => {
  // 清空当前页面的帖子列表
  const data = storePosts()
  cachePosts.splice(0, cachePosts.length, ...data.cachePosts)
  cacheTotalNum.value = data.cacheTotalNum
  Object.assign(cacheCondition, data.cacheConditions)
})

onBeforeRouteLeave(async () => {
  // 保存滚动位置
  scrollTop.value = getWindowScrollY()
  // 清空当前页面的帖子列表
  const data = storePosts()
  cachePosts.splice(0, cachePosts.length, ...data.cachePosts)
  cachePartition.value = route.params.name
  cacheTotalNum.value = data.cacheTotalNum
  Object.assign(cacheCondition, data.cacheConditions)
})
</script>

<template>
  <div class="partition-feed w-full">
    <h2 class="partition-feed__title">
      {{ name }}
    </h2>
    <PostList :posts="posts" :is-dense="isDense" :is-loading="isLoading" :has-more="hasMore" @bottom="update" />
  </div>
</template>

<style scoped lang="scss">
.partition-feed__title {
  margin: 0 0 6px;
  padding: 0 4px;
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--chat-text, inherit);
}
</style>
