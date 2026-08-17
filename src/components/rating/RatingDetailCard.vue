<script setup lang="ts">
import type { RatingPostDetail } from '@/api/rating/types'
import { Icon } from '@iconify/vue'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { createRatingComment, deleteRatingPost, likeRatingPost, submitRatingStar } from '@/api/rating'
import { showMsg } from '@/components/MessageBox'
import { useUserStore } from '@/store/userStore'
import { ratingZonePath } from '@/utils/ratingRoute'
import UserAvatar from '../UserAvatar.vue'
import RatingDistribution from './RatingDistribution.vue'

const { post } = defineProps<{
  post: RatingPostDetail
}>()

const emits = defineEmits<{
  infoChange: ['like' | 'delete' | 'comment' | 'rating']
}>()

const MarkdownContainer = defineAsyncComponent(() => import('../MarkdownContainer.vue'))
const MarkdownEditor = defineAsyncComponent(() => import('../MarkdownEditor.vue'))
const OldImages = defineAsyncComponent(() => import('@/components/OldImages.vue'))

const { userInfo } = useUserStore()

const showCompose = ref(false)
const commentContent = ref('')
const commentSubmitting = ref(false)

const profileOwnerId = computed(() => {
  const n = Number(post.userID)
  return Number.isFinite(n) && n > 0 ? n : 0
})

const currStars = ref<[number, number, number, number, number]>(
  [...(post.stars || [0, 0, 0, 0, 0])] as [number, number, number, number, number],
)
const currRating = ref(post.userStar || 0)
const averageRating = ref(post.averageRating || 0)
const raterCount = computed(() => currStars.value.reduce((s, n) => s + n, 0))
const isOwner = computed(() => post.userTelephone === userInfo.phone)

watch(() => post.userStar, (v) => {
  if (typeof v === 'number' && v >= 0)
    currRating.value = v
}, { immediate: true })

watch(() => post.stars, (s) => {
  if (s?.length === 5)
    currStars.value = [...s] as [number, number, number, number, number]
}, { deep: true })

watch(() => post.averageRating, (v) => {
  averageRating.value = v
})

function formatTime(t: string) {
  const d = new Date(t)
  if (Number.isNaN(d.getTime()))
    return t
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function onStarClick(n: number) {
  const prev = currRating.value
  currRating.value = n
  try {
    const ok = await submitRatingStar(post.ratingPostID, n)
    if (ok)
      emits('infoChange', 'rating')
    else
      currRating.value = prev
  }
  catch {
    showMsg('评分失败')
    currRating.value = prev
  }
}

async function onLike() {
  try {
    const ok = await likeRatingPost(post.ratingPostID)
    if (ok)
      emits('infoChange', 'like')
  }
  catch {
    showMsg('点赞失败')
  }
}

async function onDelete() {
  if (!confirm('确定删除这条评分？'))
    return
  try {
    const ok = await deleteRatingPost(post.ratingPostID)
    if (ok)
      emits('infoChange', 'delete')
  }
  catch {
    showMsg('删除失败')
  }
}

async function submitComment() {
  if (!commentContent.value.trim() && currRating.value === 0) {
    showMsg('请写评论或先评分')
    return
  }
  if (commentSubmitting.value)
    return
  commentSubmitting.value = true
  try {
    const ok = await createRatingComment(
      post.ratingPostID,
      commentContent.value,
      currRating.value,
    )
    if (ok) {
      showMsg('已发布')
      commentContent.value = ''
      showCompose.value = false
      emits('infoChange', 'comment')
    }
    else {
      showMsg('发布失败')
    }
  }
  finally {
    commentSubmitting.value = false
  }
}
</script>

<template>
  <article class="rating-detail-card rating-zone">
    <header class="rd-card__head">
      <div class="rd-card__author">
        <UserAvatar
          :src="post.userAvatar"
          :user-id="profileOwnerId"
          :user-identity="post.userIdentity"
          :user-name="post.userName"
          :user-score="post.userScore"
        />
        <div class="rd-card__author-meta">
          <span class="rd-card__author-name">{{ post.userName || '用户' }}</span>
          <span class="rd-card__time">{{ formatTime(post.createdAt) }}</span>
        </div>
      </div>
      <div class="rd-card__actions">
        <button
          type="button"
          class="rd-card__act"
          :class="{ 'rd-card__act--like-on': post.isLiked }"
          aria-label="点赞"
          @click="onLike"
        >
          <Icon :icon="post.isLiked ? 'tabler:heart-filled' : 'tabler:heart'" width="18" height="18" />
          <span>{{ post.like }}</span>
        </button>
        <button
          v-if="isOwner"
          type="button"
          class="rd-card__act rd-card__act--danger"
          aria-label="删除"
          @click="onDelete"
        >
          <Icon icon="tabler:trash" width="18" height="18" />
        </button>
      </div>
    </header>

    <RouterLink
      v-if="post.categoryName && post.categoryID"
      :to="ratingZonePath(post.categoryID)"
      class="rd-card__zone"
    >
      <Icon icon="tabler:folder" width="14" height="14" aria-hidden="true" />
      {{ post.categoryName }}
      <span class="rd-card__zone-more">同分区更多</span>
      <Icon icon="tabler:chevron-right" width="14" height="14" aria-hidden="true" />
    </RouterLink>

    <h1 class="rd-card__title">
      {{ post.title || '未命名评分' }}
    </h1>

    <div class="rd-card__stats">
      <span><Icon icon="tabler:eye" width="14" height="14" /> {{ post.browse }}</span>
      <span><Icon icon="tabler:message" width="14" height="14" /> {{ post.comment }}</span>
      <span><Icon icon="tabler:users" width="14" height="14" /> {{ raterCount }} 人评</span>
    </div>

    <RatingDistribution
      class="rd-card__dist"
      dense
      :stars="currStars"
      :average-rating="averageRating"
      :user-rating="currRating"
      :show-user-rating="true"
      @rating-click="onStarClick"
    />

    <div v-if="post.content" class="rd-card__content">
      <MarkdownContainer :markdown-content="post.content" />
    </div>
    <OldImages v-if="post.photos" :photos="post.photos" />

    <footer class="rd-card__foot">
      <button
        type="button"
        class="rd-card__compose-toggle"
        :class="{ 'rd-card__compose-toggle--open': showCompose }"
        @click="showCompose = !showCompose"
      >
        <Icon icon="tabler:message-plus" width="16" height="16" />
        {{ showCompose ? '收起评论' : '写评论' }}
      </button>
    </footer>

    <div v-show="showCompose" class="rd-card__compose">
      <MarkdownEditor
        v-model="commentContent"
        compact
        placeholder="写下你的评价…"
        :submit-busy="commentSubmitting"
        @send="submitComment"
      />
    </div>
  </article>
</template>

<style scoped lang="scss">
.rating-detail-card {
  border: none;
  border-radius: var(--radius-lg, 8px);
  background: var(--color-card, #fff);
  box-shadow: var(--color-card-shadow);
  overflow: hidden;
}

.rd-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
}

.rd-card__author {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.rd-card__author-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.rd-card__author-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rd-card__time {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.rd-card__actions {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
}

.rd-card__act {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 6px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md, 8px);
  background: transparent;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;

  &--like-on {
    color: var(--color-error, #ef4444);
    border-color: var(--color-error-soft, rgba(239, 68, 68, 0.2));
    background: var(--color-error-soft, rgba(239, 68, 68, 0.06));
  }

  &--danger {
    color: var(--color-error, #ef4444);
    border-color: var(--color-error-soft, rgba(239, 68, 68, 0.2));
  }
}

.rd-card__zone {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 8px 12px 0;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: var(--radius-sm, 4px);
  text-decoration: none;
  width: fit-content;
  max-width: calc(100% - 24px);

  &:hover {
    text-decoration: underline;
  }
}

.rd-card__zone-more {
  font-weight: 500;
  opacity: 0.85;
}

.rd-card__title {
  margin: 6px 12px 4px;
  padding: 0;
  font-size: 17px;
  font-weight: 800;
  line-height: 1.35;
  color: var(--color-text);
}

.rd-card__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0 12px 8px;
  font-size: 11px;
  color: var(--color-text-secondary);

  span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
}

.rd-card__dist {
  margin: 0 10px 10px;
}

.rd-card__content {
  padding: 0 12px 8px;
  font-size: 14px;
  line-height: 1.55;
}

.rd-card__foot {
  padding: 8px 12px;
  border-top: 1px solid var(--color-border);
}

.rd-card__compose-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: none;
  border-radius: var(--radius-md, 8px);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &--open {
    background: var(--accent);
    color: var(--color-button, #fff);
  }
}

.rd-card__compose {
  padding: 0 10px 10px;
  border-top: 1px dashed var(--color-border);
}
</style>
