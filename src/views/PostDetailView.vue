<script setup lang="ts">
import type { Comment, RatingComment } from '@/types/comment'
import type { Post, PostType, Rating } from '@/types/post'

import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCommentsByPostID } from '@/api/browse/getComment'

import { getPostByID, getPostTypeByID } from '@/api/browse/getPost'

import DetailCard from '@/components/card/DetailCard.vue'

import { showImg } from '@/components/ImageShower'
import { showMsg } from '@/components/MessageBox'
import RatingDetailCard from '@/components/rating/RatingDetailCard.vue'
import { useNewPostsStore } from '@/store/newPostsStore'
import { usePostStore } from '@/store/postStore'
import { useUserStore } from '@/store/userStore'
import { strHandler } from '@/utils/strHandler'
import { setTitle } from '@/utils/title'

const { updatePost } = usePostStore()
const { removeNewPostId } = useNewPostsStore()

const CommentCard = defineAsyncComponent(() => import('@/components/card/CommentCard.vue'))
const RatingCommentCard = defineAsyncComponent(() => import('@/components/rating/RatingCommentCard.vue'))

const route = useRoute()
const router = useRouter()

const { userInfo } = useUserStore()

const post = ref<Post | Rating>()
const comments = ref<Comment[] | RatingComment[]>([])

const postType = ref<PostType>('post')

/** 主评论时间排序：降序 = 最新在前，升序 = 最早在前 */
type CommentTimeOrder = 'desc' | 'asc'

function commentTimeMs(c: Comment | RatingComment): number {
  const raw = c.CommentTime as unknown
  if (typeof raw === 'number' && Number.isFinite(raw))
    return raw
  if (!raw || typeof raw !== 'string')
    return 0
  let ms = Date.parse(raw)
  if (Number.isFinite(ms))
    return ms
  const normalized = raw.trim().replace(' ', 'T')
  ms = Date.parse(normalized)
  if (Number.isFinite(ms))
    return ms
  return 0
}

const commentTimeOrder = ref<CommentTimeOrder>('desc')
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

function setCommentTimeOrder(order: CommentTimeOrder) {
  commentTimeOrder.value = order
}

async function commentHandler() {
  if (!post.value)
    return
  await getCommentList()
  let len = 0

  for (const comment of comments.value) {
    if (comment.SubComments) {
      len += comment.SubComments.length
    }
    len += 1 // 包括主评论
  }
  post.value.Comment = len
}

async function getCommentList() {
  try {
    const ID = Number(route.params.id)
    const curComments = await getCommentsByPostID(ID, userInfo.phone, postType.value)
    comments.value = curComments ?? []
  }
  catch (e) {
    showMsg(`获取评论失败: ${e}`)
  }
}

async function refreshPostData() {
  try {
    const ID = Number(route.params.id)
    const curPost = await getPostByID(ID, userInfo.phone, postType.value)
    post.value = curPost
  }
  catch (e) {
    showMsg(`获取帖子数据失败: ${e}`)
  }
}

/**
 *
 * @description 复制代码和展示图片。直接绑定根容器
 */
async function clickHandler(event: MouseEvent) {
  /**
   * 在css里已经去除了pre标签的点击，只保留了pre::before的点击
   */
  const el = event.target as HTMLElement
  if (!el)
    return
  if (el.tagName === 'CODE') {
    const code = el.textContent
    if (!code)
      return
    await navigator.clipboard.writeText(code)
    showMsg('代码已复制')
  }
  else if (el.tagName === 'IMG') {
    // 拿到图片的src
    const src = (el as HTMLImageElement).src
    // 如果class名为user-avatar，直接不展示
    if (el.classList.contains('user-avatar-img')) {
      return
    }
    const uploadImg = strHandler('postImg', src)
    showImg(uploadImg)
  }
}

function infoChange(type: 'like' | 'save' | 'delete' | 'comment' | 'rating') {
  const ID = Number(route.params.id)
  updatePost(ID, type)
  switch (type) {
    case 'like': {
      post.value!.IsLiked = !post.value!.IsLiked
      post.value!.Like += post.value!.IsLiked ? 1 : -1
      break
    }
    case 'save': {
      post.value!.IsSaved = !post.value!.IsSaved
      break
    }
    case 'delete': {
      router.push('/')
      break
    }
    case 'comment': {
      // 评论更新，重新获取评论列表
      commentHandler()
      break
    }
    case 'rating': {
      // 评分更新，重新获取帖子数据以更新评分信息
      refreshPostData()
      commentHandler()

      break
    }
  }
}

onMounted(async () => {
  try {
    const ID = Number(route.params.id)
    postType.value = await getPostTypeByID(ID)
    await Promise.all([
      (async () => {
        const curPost = await getPostByID(ID, userInfo.phone, postType.value)
        post.value = curPost
        setTitle(post.value.Title)
      })(),
      getCommentList(),
    ])
    // 从新帖子列表中移除当前帖子ID
    removeNewPostId(ID)
  }
  catch (e) {
    showMsg(`获取帖子失败: ${e}`)
  }
})
</script>

<template>
  <div
    class="root w-full flex flex-col p-1%"
    @click="clickHandler"
    @comment-handle="commentHandler"
  >
    <template v-if="post">
      <template v-if="postType === 'post'">
        <DetailCard
          :post="post as Post"
          @info-change="infoChange"
        />
      </template>
      <template v-else-if="postType === 'rating'">
        <RatingDetailCard
          :post="post as Rating"
          @info-change="infoChange"
        />
      </template>
      <template v-else>
        <div>未知帖子类型</div>
      </template>
    </template>
    <div v-else>
      loading...
    </div>
    <div class="comment-block mx-a mt-5 w-15/16">
      <div class="comment-sort-header">
        <h2 class="comment-sort-title">
          评论
        </h2>
        <div class="sort-toolbar" role="group" aria-label="评论排序">
          <button
            type="button"
            class="sort-btn sort-btn--desc"
            :class="{ 'sort-btn--active': commentTimeOrder === 'desc' }"
            :aria-pressed="commentTimeOrder === 'desc'"
            aria-label="按时间降序：最新评论在前"
            @click.stop="setCommentTimeOrder('desc')"
          >
            <svg
              class="sort-btn__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v5l2.5 1.5" />
              <path d="M18 15l-6-6-6 6" />
            </svg>
            <span class="sort-btn__label">
              <span class="sort-btn__text" aria-hidden="true">最新在前</span>
            </span>
          </button>
          <button
            type="button"
            class="sort-btn sort-btn--asc"
            :class="{ 'sort-btn--active': commentTimeOrder === 'asc' }"
            :aria-pressed="commentTimeOrder === 'asc'"
            aria-label="按时间升序：最早评论在前"
            @click.stop="setCommentTimeOrder('asc')"
          >
            <svg
              class="sort-btn__icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v5l2.5 1.5" />
              <path d="M6 9l6 6 6-6" />
            </svg>
            <span class="sort-btn__label">
              <span class="sort-btn__text" aria-hidden="true">最早在前</span>
            </span>
          </button>
        </div>
      </div>
      <!-- 这是评论区 -->
      <div
        v-if="post"
        class="commentList min-w-0 w-full"
      >
        <!-- 使用id-评论数作为key使每次评论重新渲染当前评论 -->
        <!-- Post类型固定渲染 -->
        <template v-if="postType === 'post'">
          <CommentCard
            v-for="comment in sortedComments"
            :key="comment.PcommentID"
            class="comment-list-item mx-a w-full"
            :post-id="post.PostID"
            :commentable="true"
            :is-dence="false"
            :comment="comment as Comment"
          />
        </template>

        <!-- Rating类型固定渲染 -->
        <template v-else-if="postType === 'rating'">
          <RatingCommentCard
            v-for="comment in sortedComments"
            :key="comment.PcommentID"
            class="mx-a my-3 w-full"
            :post-id="post.PostID"
            :commentable="false"
            :is-dence="false"
            :comment="comment as RatingComment"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.root {
  color: var(--color-text);
}

.comment-block {
  box-sizing: border-box;
  max-width: 100%;
}

.comment-list-item {
  margin-top: 12px;
  margin-bottom: 0;
}

.comment-list-item:first-child {
  margin-top: 8px;
}

.comment-sort-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: clamp(14px, 4vw, 28px);
  margin-bottom: 0.75rem;
  width: 100%;
  box-sizing: border-box;
  flex-wrap: nowrap;
  min-width: 0;
}

.comment-sort-title {
  margin: 0;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 2px;
  font-size: clamp(1.28rem, 4.2vw, 1.48rem);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0.03em;
  color: var(--chat-text, var(--color-text));
}

.sort-toolbar {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  justify-content: flex-end;
  gap: clamp(6px, 2vw, 10px);
}

.sort-btn {
  flex: 0 0 auto;
  min-width: clamp(5.5rem, 28vw, 7rem);
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: clamp(4px, 1.2vw, 6px);
  min-height: clamp(34px, 9vw, 40px);
  padding: clamp(6px, 1.5vw, 9px) clamp(8px, 2.2vw, 12px);
  border-radius: 10px;
  border: 1px solid transparent;
  font-size: clamp(11px, 2.9vw, 13px);
  font-weight: 600;
  font-family: inherit;
  text-transform: none;
  letter-spacing: 0.01em;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.sort-btn__label {
  min-width: 0;
  overflow: visible;
  white-space: nowrap;
}

.sort-btn__text {
  display: inline;
}

.sort-btn:active {
  transform: scale(0.98);
}

.sort-btn__icon {
  flex-shrink: 0;
  display: block;
  width: clamp(14px, 3.8vw, 18px);
  height: clamp(14px, 3.8vw, 18px);
  opacity: 0.95;
}

/* 最新在前 — 浅红系 */
.sort-btn--desc {
  background: #fef2f2;
  border-color: rgba(244, 63, 94, 0.28);
  color: #9f1239;
}

.sort-btn--desc .sort-btn__icon {
  color: #e11d48;
}

.sort-btn--desc:hover {
  background: #ffe4e6;
  border-color: rgba(244, 63, 94, 0.45);
  color: #881337;
}

.sort-btn--desc.sort-btn--active {
  background: #fecdd3;
  border-color: #fb7185;
  color: #881337;
  box-shadow: 0 0 0 1px rgba(251, 113, 133, 0.45);
}

.sort-btn--desc.sort-btn--active .sort-btn__icon {
  color: #be123c;
}

/* 最早在前 — 浅蓝系 */
.sort-btn--asc {
  background: #eff6ff;
  border-color: rgba(59, 130, 246, 0.28);
  color: #1e40af;
}

.sort-btn--asc .sort-btn__icon {
  color: #2563eb;
}

.sort-btn--asc:hover {
  background: #dbeafe;
  border-color: rgba(59, 130, 246, 0.45);
  color: #1e3a8a;
}

.sort-btn--asc.sort-btn--active {
  background: #bfdbfe;
  border-color: #60a5fa;
  color: #1e3a8a;
  box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.5);
}

.sort-btn--asc.sort-btn--active .sort-btn__icon {
  color: #1d4ed8;
}

body.dark-mode .comment-sort-title {
  color: var(--chat-text, #e2e8f0);
}

body.dark-mode .sort-btn--desc {
  background: rgba(136, 19, 55, 0.35);
  border-color: rgba(251, 113, 133, 0.35);
  color: #fecdd3;
}

body.dark-mode .sort-btn--desc .sort-btn__icon {
  color: #fda4af;
}

body.dark-mode .sort-btn--desc:hover {
  background: rgba(136, 19, 55, 0.5);
  border-color: rgba(251, 113, 133, 0.55);
  color: #fff1f2;
}

body.dark-mode .sort-btn--desc.sort-btn--active {
  background: rgba(190, 18, 60, 0.55);
  border-color: #fb7185;
  color: #fff1f2;
  box-shadow: 0 0 0 1px rgba(251, 113, 133, 0.35);
}

body.dark-mode .sort-btn--asc {
  background: rgba(30, 58, 138, 0.4);
  border-color: rgba(96, 165, 250, 0.35);
  color: #dbeafe;
}

body.dark-mode .sort-btn--asc .sort-btn__icon {
  color: #93c5fd;
}

body.dark-mode .sort-btn--asc:hover {
  background: rgba(30, 58, 138, 0.55);
  border-color: rgba(96, 165, 250, 0.55);
  color: #f0f9ff;
}

body.dark-mode .sort-btn--asc.sort-btn--active {
  background: rgba(37, 99, 235, 0.45);
  border-color: #60a5fa;
  color: #f0f9ff;
  box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.4);
}
</style>
