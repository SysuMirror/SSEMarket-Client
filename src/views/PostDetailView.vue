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

.comment-list-item {
  margin-top: 12px;
  margin-bottom: 0;
}

.comment-list-item:first-child {
  margin-top: 8px;
}
</style>
