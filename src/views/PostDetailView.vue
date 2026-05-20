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
 * @description 帖子详情内点击图片预览（代码复制由 MarkdownContainer 处理）
 */
async function clickHandler(event: MouseEvent) {
  const el = event.target as HTMLElement
  if (!el)
    return
  if (el.closest('.md-code-block__copy'))
    return
  if (el.tagName === 'IMG') {
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
    class="post-detail-page w-full flex flex-col p-1%"
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
    <section class="comment-panel mx-a w-15/16">
      <header class="comment-panel__header">
        <h2 class="comment-panel__title">
          评论
          <span v-if="post" class="comment-panel__count">{{ post.Comment }}</span>
        </h2>
        <div class="sort-switch" role="group" aria-label="评论排序">
          <span
            class="sort-switch__thumb"
            :class="{ 'sort-switch__thumb--asc': commentTimeOrder === 'asc' }"
            aria-hidden="true"
          />
          <button
            type="button"
            class="sort-switch__option"
            :class="{ 'sort-switch__option--active': commentTimeOrder === 'desc' }"
            :aria-pressed="commentTimeOrder === 'desc'"
            @click.stop="setCommentTimeOrder('desc')"
          >
            最新在前
          </button>
          <button
            type="button"
            class="sort-switch__option"
            :class="{ 'sort-switch__option--active': commentTimeOrder === 'asc' }"
            :aria-pressed="commentTimeOrder === 'asc'"
            @click.stop="setCommentTimeOrder('asc')"
          >
            最早在前
          </button>
        </div>
      </header>
      <div
        v-if="post"
        class="comment-panel__list"
      >
        <p
          v-if="sortedComments.length === 0"
          class="comment-panel__empty"
        >
          暂无评论，来发表第一条吧
        </p>
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
            class="comment-list-item w-full"
            :post-id="post.PostID"
            :commentable="false"
            :is-dence="false"
            :comment="comment as RatingComment"
          />
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.post-detail-page {
  color: var(--color-text);
  flex-shrink: 0;

  > * {
    flex-shrink: 0;
  }
}

.comment-panel__count {
  margin-left: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--chat-text-secondary);
}
</style>
