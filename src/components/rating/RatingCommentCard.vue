<script setup lang="ts">
import type { RatingComment } from '@/types/comment'
import CommentCard from '../card/CommentCard.vue'

import RatingShow from './RatingShow.vue'

defineOptions({
  name: 'RatingCommentCard',
})

const _ = defineProps<RatingCommentProps>()

// 1. 定义继承的 props（必须包含原组件的所有必需 props）
interface RatingCommentProps {
  comment: RatingComment
  postId: number
  commentable: boolean
  isDence: boolean
  likeMode?: 'post' | 'rating'
}
</script>

<template>
  <CommentCard
    :comment="_.comment"
    :post-id="postId"
    :commentable="commentable"
    :is-dence="isDence"
    :like-mode="_.likeMode ?? 'rating'"
  >
    <!-- 填充right-extension插槽 -->
    <template #right-extension>
      <RatingShow
        :rating="_.comment.AuthorRating"
        :editable="false"
      />
    </template>
  </CommentCard>
</template>
