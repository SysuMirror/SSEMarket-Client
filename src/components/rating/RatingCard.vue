<script setup lang="ts">
import type { RatingPostItem } from '@/api/rating/types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { likeRatingPost } from '@/api/rating'
import { showMsg } from '@/components/MessageBox'
import { ratingZonePath } from '@/utils/ratingRoute'

defineOptions({ name: 'RatingCard' })

const { post } = defineProps<{
  post: RatingPostItem
}>()

const emit = defineEmits<{ likeChange: [] }>()

const totalRatings = computed(() =>
  (post.stars || []).reduce((sum, count) => sum + count, 0),
)

const scoreText = computed(() => (post.averageRating || 0).toFixed(1))

async function like(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  try {
    const ok = await likeRatingPost(post.ratingPostID)
    if (ok)
      emit('likeChange')
    else
      showMsg('操作失败')
  }
  catch (err) {
    showMsg('失败')
    console.error(err)
  }
}
</script>

<template>
  <article class="hp-rating-card">
    <RouterLink class="hp-rating-card__main" :to="`/rating/${post.ratingPostID}`">
      <div class="hp-rating-card__left">
        <RouterLink
          v-if="post.categoryName && post.categoryID"
          :to="ratingZonePath(post.categoryID)"
          class="hp-rating-card__zone"
          @click.stop
        >
          <Icon icon="tabler:folder" width="12" height="12" aria-hidden="true" />
          {{ post.categoryName }}
          <Icon icon="tabler:chevron-right" width="12" height="12" aria-hidden="true" />
        </RouterLink>
        <h3 class="hp-rating-card__title">
          {{ post.title || '未命名评分' }}
        </h3>
        <div class="hp-rating-card__meta">
          <span>{{ totalRatings }} 人评</span>
          <span class="hp-rating-card__dot">·</span>
          <span>{{ post.comment }} 评</span>
          <span class="hp-rating-card__dot">·</span>
          <span>{{ post.browse }} 阅</span>
        </div>
      </div>
      <div class="hp-rating-card__score" aria-label="综合评分">
        <span class="hp-rating-card__score-num">{{ scoreText }}</span>
      </div>
    </RouterLink>
    <button
      type="button"
      class="hp-rating-card__like"
      :class="{ 'hp-rating-card__like--on': post.isLiked }"
      :aria-label="post.isLiked ? '取消赞' : '点赞'"
      @click="like"
    >
      <Icon :icon="post.isLiked ? 'tabler:heart-filled' : 'tabler:heart'" width="16" height="16" />
      <span>{{ post.like }}</span>
    </button>
  </article>
</template>

<style scoped lang="scss">
.hp-rating-card {
  display: flex;
  align-items: stretch;
  gap: 0;
  background: var(--color-card, #fff);
  border: none;
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--color-card-shadow);
  overflow: hidden;
  transition: box-shadow 0.15s ease;

  &:hover {
    box-shadow: var(--color-card-hover-shadow);
  }
}

.hp-rating-card__main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 10px;
  color: inherit;
  text-decoration: none;
}

.hp-rating-card__left {
  flex: 1;
  min-width: 0;
}

.hp-rating-card__zone {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 3px;
  padding: 1px 6px 1px 4px;
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: var(--radius-sm, 4px);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.hp-rating-card__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--color-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hp-rating-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  margin-top: 3px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

.hp-rating-card__dot {
  opacity: 0.6;
}

.hp-rating-card__score {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 44px;
  padding: 0 6px;
  border-radius: var(--radius-md, 8px);
  background: var(--accent);
  color: var(--color-button, #fff);
}

.hp-rating-card__score-num {
  font-size: 20px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.hp-rating-card__like {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 40px;
  padding: 0 4px;
  border: none;
  border-left: 1px solid var(--color-border);
  background: transparent;
  font-size: 10px;
  color: var(--color-text-secondary);
  cursor: pointer;

  &--on {
    color: var(--color-error, #ef4444);
  }
}
</style>
