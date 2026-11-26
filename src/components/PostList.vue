<script setup lang="ts">
import type { Post } from '@/types/post'
import type { ComponentPublicInstance } from 'vue'

import { computed, onUnmounted, useTemplateRef, watch } from 'vue'
import { createImpressionTracker } from '@/analytics/telemetry'
import PostCard from './card/PostCard.vue'
import PageSkeleton from './PageSkeleton.vue'

const { isDense, posts = [], isLoading = false, hasMore = true, newPostIds = [], searchId, source } = defineProps<{
  isDense?: boolean
  posts?: Post[]
  isLoading?: boolean
  hasMore?: boolean
  newPostIds?: number[]
  searchId?: string
  source?: string
}>()

const resolvedSource = computed(() => source || (searchId ? 'search' : 'feed'))
const impressionTracker = createImpressionTracker(() => resolvedSource.value)

function bindImpressionRef(el: Element | ComponentPublicInstance | null, postId: number, position: number) {
  if (!el)
    return
  const dom = el instanceof Element ? el : (el.$el instanceof Element ? el.$el : null)
  if (dom)
    impressionTracker.observe(dom, postId, position)
}

const emits = defineEmits(['bottom', 'pinChange'])

const bottom = useTemplateRef('bottom')
let observer: IntersectionObserver

function startObserver() {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting)
          emits('bottom')
      })
    },
    {
      root: null,
      rootMargin: '240px 0px',
      threshold: 0,
    },
  )
  if (bottom.value)
    observer.observe(bottom.value)
}

function endObserver() {
  if (observer) {
    observer.disconnect()
  }
}

watch(
  () => bottom.value,
  (newValue) => {
    if (newValue) {
      endObserver()
      startObserver()
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  endObserver()
  impressionTracker.dispose()
})
</script>

<template>
  <div class="w-full">
    <!-- 首屏还没任何数据时先摆骨架，避免整页空白 -->
    <PageSkeleton v-if="isLoading && !posts.length" variant="feed" :count="isDense ? 3 : 4" />
    <PostCard
      v-for="(post, index) in posts"
      :key="post.PostID"
      :ref="(el) => bindImpressionRef(el, post.PostID, index + 1)"
      class="feed-list__item"
      :is-dense="isDense"
      :is-new="newPostIds.includes(post.PostID)"
      :post="post"
      :search-id="searchId"
      :source="resolvedSource"
      :result-rank="index + 1"
      @pin-change="emits('pinChange', $event)"
    />
    <template v-if="hasMore">
      <div
        v-show="posts.length || !isLoading"
        ref="bottom"
        class="feed-list__footer"
        :class="{ 'feed-list__footer--loading': isLoading }"
      >
        {{ isLoading ? '加载中…' : '继续下滑加载更多' }}
      </div>
    </template>
    <template v-else>
      <div class="feed-list__footer">
        暂无更多
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.feed-list__footer {
  &--loading {
    opacity: 0.7;
  }
}

.list-enter-active,
.list-leave-active {
  opacity: 1;
  transition: all 0.5s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
}
</style>
