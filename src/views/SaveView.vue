<script setup lang="ts">
import {
  onMounted,
} from 'vue'

import PostList from '@/components/PostList.vue'
import { usePostListCache } from '@/composables/usePostListCache'
import { usePostView } from '@/composables/usePostView'
import { setWindowScrollY } from '@/utils/windowScroll'

defineOptions({
  name: 'SaveView',
})

const view = usePostView()
const { posts, hasMore, isLoading, update, initialize } = view

usePostListCache(view)

onMounted(async () => {
  setWindowScrollY(0)
  await initialize('收藏')
})
</script>

<template>
  <div class="w-full">
    <h2>收藏</h2>
    <PostList :posts="posts" :is-loading="isLoading" :has-more="hasMore" @bottom="update" />
  </div>
</template>
