<script setup lang="ts">
import type { RatingCommentItem, RatingPostDetail } from '@/api/rating/types'
import type { RatingComment } from '@/types/comment'
import { Icon } from '@iconify/vue'
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getRatingComments, getRatingPostDetail } from '@/api/rating'
import CommentSortSwitch from '@/components/CommentSortSwitch.vue'
import { showImg } from '@/components/ImageShower'
import { showMsg } from '@/components/MessageBox'
import RatingDetailCard from '@/components/rating/RatingDetailCard.vue'
import { useUserStore } from '@/store/userStore'
import { strHandler } from '@/utils/strHandler'
import { setTitle } from '@/utils/title'

defineOptions({ name: 'RatingDetailView' })

const RatingCommentCard = defineAsyncComponent(() => import('@/components/rating/RatingCommentCard.vue'))

const route = useRoute()
const router = useRouter()
const { userInfo } = useUserStore()

const post = ref<RatingPostDetail | null>(null)
const comments = ref<RatingComment[]>([])
const loading = ref(true)
const commentTimeOrder = ref<'desc' | 'asc'>('desc')

function commentTimeMs(c: RatingComment): number {
  const raw = c.CommentTime as unknown
  if (typeof raw === 'number' && Number.isFinite(raw))
    return raw
  if (!raw || typeof raw !== 'string')
    return 0
  let ms = Date.parse(raw)
  if (Number.isNaN(ms))
    ms = Date.parse(raw.trim().replace(' ', 'T'))
  return Number.isFinite(ms) ? ms : 0
}

const sortedComments = computed(() => {
  const list = [...comments.value]
  list.sort((a, b) => {
    const diff = commentTimeMs(b) - commentTimeMs(a)
    if (diff !== 0)
      return commentTimeOrder.value === 'desc' ? diff : -diff
    return commentTimeOrder.value === 'desc'
      ? b.PcommentID - a.PcommentID
      : a.PcommentID - b.PcommentID
  })
  return list
})

function toRatingComment(c: RatingCommentItem): RatingComment {
  return {
    PcommentID: c.commentID,
    AuthorID: c.authorID,
    Author: c.author,
    AuthorTelephone: c.authorTelephone,
    AuthorScore: c.authorScore,
    AuthorAvatar: c.authorAvatar,
    AuthorIdentity: c.authorIdentity,
    CommentTime: c.commentTime,
    Content: c.content,
    LikeNum: c.likeNum,
    DenyNum: 0,
    SubComments: [],
    IsLiked: c.isLiked,
    IsDenied: false,
    AuthorRating: c.authorRating,
  }
}

async function loadComments() {
  const id = Number(route.params.id)
  comments.value = (await getRatingComments(id)).map(toRatingComment)
  if (post.value)
    post.value.comment = comments.value.length
}

async function refreshPost() {
  const id = Number(route.params.id)
  const detail = await getRatingPostDetail(id)
  if (!detail) {
    showMsg('评分帖不存在')
    router.replace('/rating')
    return
  }
  post.value = detail
  setTitle(detail.title)
}

async function onInfoChange(type: 'like' | 'delete' | 'comment' | 'rating') {
  if (!post.value)
    return
  switch (type) {
    case 'like':
      post.value.isLiked = !post.value.isLiked
      post.value.like += post.value.isLiked ? 1 : -1
      break
    case 'delete':
      router.push('/rating')
      break
    case 'comment':
    case 'rating':
      await Promise.all([refreshPost(), loadComments()])
      break
  }
}

function onImageClick(event: MouseEvent) {
  const el = event.target as HTMLElement
  if (!el?.closest('.md-code-block__copy') && el?.tagName === 'IMG' && !el.classList.contains('user-avatar-img')) {
    showImg(strHandler('postImg', (el as HTMLImageElement).src))
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await refreshPost()
    await loadComments()
  }
  catch (e) {
    showMsg(`加载失败: ${e}`)
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="rating-zone rating-detail-page" @click="onImageClick">
    <header class="rating-detail-page__nav">
      <button type="button" class="rating-detail-page__back" aria-label="返回" @click="router.back()">
        <Icon icon="tabler:arrow-left" width="18" height="18" />
      </button>
      <span class="rating-detail-page__nav-title">评分详情</span>
    </header>

    <div v-if="loading" class="rating-detail-page__loading">
      加载中…
    </div>

    <template v-else-if="post">
      <RatingDetailCard :post="post" @info-change="onInfoChange" />

      <section class="rating-detail-page__comments">
        <header class="rating-detail-page__comments-head">
          <h2 class="rating-detail-page__comments-title">
            评价
            <span class="rating-detail-page__comments-count">{{ post.comment }}</span>
          </h2>
          <CommentSortSwitch v-model="commentTimeOrder" />
        </header>

        <p v-if="sortedComments.length === 0" class="rating-detail-page__comments-empty">
          暂无评价，来写第一条吧
        </p>
        <RatingCommentCard
          v-for="c in sortedComments"
          :key="c.PcommentID"
          class="rating-detail-page__comment-item"
          :comment="c"
          :post-id="post.ratingPostID"
          :commentable="false"
          :is-dence="true"
          like-mode="rating"
        />
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.rating-detail-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 8px 10px 24px;
  box-sizing: border-box;
}

.rating-detail-page__nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.rating-detail-page__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--hp-border, var(--chat-border));
  border-radius: 8px;
  background: var(--hp-card, var(--chat-bg-elevated));
  cursor: pointer;
}

.rating-detail-page__nav-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--hp-muted, var(--chat-text-secondary));
}

.rating-detail-page__loading {
  padding: 32px;
  text-align: center;
  font-size: 13px;
  color: var(--hp-muted, var(--chat-text-secondary));
}

.rating-detail-page__comments {
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid var(--hp-border, var(--chat-border));
  border-radius: 10px;
  background: var(--hp-card, var(--chat-bg-elevated));
}

.rating-detail-page__comments-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: nowrap;
}

.rating-detail-page__comments-title {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 800;
}

.rating-detail-page__comments-count {
  margin-left: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--hp-muted, var(--chat-text-secondary));
}

.rating-detail-page__comments-empty {
  margin: 0;
  padding: 16px 0;
  text-align: center;
  font-size: 12px;
  color: var(--hp-muted, var(--chat-text-secondary));
}

.rating-detail-page__comment-item {
  margin-bottom: 6px;

  &:last-child {
    margin-bottom: 0;
  }
}
</style>
