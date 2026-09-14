<script setup lang="ts">
import type { Post } from '@/types/post'

import { onUnmounted, useTemplateRef, watch } from 'vue'
import PostCard from './card/PostCard.vue'

const { isDense, posts = [], isLoading = false, hasMore = true, newPostIds = [] } = defineProps<{
  isDense?: boolean
  posts?: Post[]
  isLoading?: boolean
  hasMore?: boolean
  newPostIds?: number[]
}>()

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
})
</script>

<template>
  <div class="w-full">
    <PostCard
      v-for="post in posts"
      :key="post.PostID"
      class="feed-list__item"
      :is-dense="isDense"
      :is-new="newPostIds.includes(post.PostID)"
      :post="post"
      @pin-change="emits('pinChange', $event)"
    />
    <template v-if="hasMore">
      <div
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
