<script setup lang="ts">
import {
  onMounted,
} from 'vue'

import PostList from '@/components/PostList.vue'
import { usePostListCache } from '@/composables/usePostListCache'
import { usePostView } from '@/composables/usePostView'
import { setWindowScrollY } from '@/utils/windowScroll'

defineOptions({
  name: 'HistoryView',
})

const view = usePostView()
const { posts, hasMore, isLoading, update, initialize } = view

usePostListCache(view)

onMounted(async () => {
  setWindowScrollY(0)
  await initialize('历史')
})
</script>

<template>
  <div class="w-full">
    <h2>发帖历史</h2>
    <PostList :posts="posts" source="history" :is-loading="isLoading" :has-more="hasMore" @bottom="update" />
  </div>
</template>
