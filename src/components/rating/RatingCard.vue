<script setup lang="ts">
import type { Rating } from '@/types/post'
import PostCard from '../card/PostCard.vue'

defineOptions({
  name: 'RatingCard',
})

const { isDense, post, isNew, noSave = true } = defineProps<{
  isDense?: boolean
  post: Rating
  isNew?: boolean
  noSave?: boolean
}>()

// 计算总评分人数
function getTotalRatings() {
  return (post.Stars || []).reduce((sum, count) => sum + count, 0)
}
</script>

<template>
  <PostCard
    :is-dense="isDense"
    :post="post"
    :is-new="isNew"
    :no-save="noSave"
    v-bind="$attrs"
  >
    <!-- 评分统计信息 - 右上方 -->
    <template #right-extension>
      <div class="rating-badge-floating">
        <div class="rating-score">
          <span class="rating-number">{{ (post.Rating || 0).toFixed(1) }}</span>
          <span class="rating-stars">★</span>
        </div>
      </div>
    </template>
    <template #center-extension>
      <div class="total-ratings">
        {{ getTotalRatings() }}人评分
      </div>
    </template>
  </PostCard>
</template>

<style scoped>
.rating-badge-floating {
  position: relative;
  top: 50%;
  transform: translateY(-10%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 10px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.9) 100%);
  border-radius: 8px;
  border: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.08),
    0 2px 4px rgba(0, 0, 0, 0.04);
  backdrop-filter: blur(12px);
  min-width: 70px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.rating-score {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.rating-number {
  font-size: 20px;
  font-weight: 800;
  color: var(--chat-accent);
}

.rating-stars {
  font-size: 18px;
  color: var(--chat-accent);
}

@keyframes twinkle {
  0% {
    transform: scale(1);
  }
  100% {
    transform: scale(1.1);
  }
}

.total-ratings {
  font-size: 12px;
  color: var(--chat-text-secondary);
  font-weight: 500;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .rating-badge-floating {
    top: 50%;
    transform: translateY(-10%);
    padding: 6px 8px;
    min-width: 60px;
  }

  .rating-number {
    font-size: 18px;
  }

  .rating-stars {
    font-size: 16px;
  }

  .total-ratings {
    font-size: 10px;
  }
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .rating-badge-floating {
    background: linear-gradient(135deg, rgba(31, 41, 55, 0.95) 0%, rgba(17, 24, 39, 0.9) 100%);
    border-color: rgba(55, 65, 81, 0.8);
  }

  .rating-badge-floating:hover {
    background: linear-gradient(135deg, rgba(31, 41, 55, 0.98) 0%, rgba(17, 24, 39, 0.95) 100%);
  }

  .rating-number,
  .rating-stars {
    color: #93b4d9;
  }

  .total-ratings {
    color: var(--chat-text-secondary);
  }
}
</style>
