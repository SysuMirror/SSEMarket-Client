<script setup lang="ts">
import type { Comment } from '@/types/comment'
import type { Post } from '@/types/post'

import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LotteryDetail } from '@/api/lottery/lottery'

import { getCommentsByPostID } from '@/api/browse/getComment'
import { getPostByID } from '@/api/browse/getPost'
import { getLotteryDetail } from '@/api/lottery/lottery'
import LotteryDetailBox from '@/components/LotteryDetailBox.vue'
import CommentSortSwitch from '@/components/CommentSortSwitch.vue'
import DetailCard from '@/components/card/DetailCard.vue'
import { showImg } from '@/components/ImageShower'
import { showMsg } from '@/components/MessageBox'
import { useNewPostsStore } from '@/store/newPostsStore'
import { usePostStore } from '@/store/postStore'
import { useUserStore } from '@/store/userStore'
import { strHandler } from '@/utils/strHandler'
import { setTitle } from '@/utils/title'

const { updatePost } = usePostStore()
const { removeNewPostId } = useNewPostsStore()

const CommentCard = defineAsyncComponent(() => import('@/components/card/CommentCard.vue'))

const route = useRoute()
const router = useRouter()
const { userInfo } = useUserStore()

const post = ref<Post>()
const comments = ref<Comment[]>([])
const lottery = ref<LotteryDetail | null>(null)

type CommentTimeOrder = 'desc' | 'asc'

function commentTimeMs(c: Comment): number {
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
  return Number.isFinite(ms) ? ms : 0
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

async function commentHandler() {
  if (!post.value)
    return
  await getCommentList()
  await loadLottery()
  let len = 0
  for (const comment of comments.value) {
    if (comment.SubComments)
      len += comment.SubComments.length
    len += 1
  }
  post.value.Comment = len
}

async function loadLottery() {
  if (!post.value?.IsLottery) {
    lottery.value = null
    return
  }
  const ID = Number(route.params.id)
  lottery.value = await getLotteryDetail(ID, userInfo.phone)
}

async function getCommentList() {
  try {
    const ID = Number(route.params.id)
    const curComments = await getCommentsByPostID(ID, userInfo.phone)
    comments.value = (curComments ?? []) as Comment[]
  }
  catch (e) {
    showMsg(`获取评论失败: ${e}`)
  }
}

async function clickHandler(event: MouseEvent) {
  const el = event.target as HTMLElement
  if (!el || el.closest('.md-code-block__copy'))
    return
  if (el.tagName === 'IMG' && !el.classList.contains('user-avatar-img')) {
    showImg(strHandler('postImg', (el as HTMLImageElement).src))
  }
}

function infoChange(type: 'like' | 'save' | 'delete' | 'comment' | 'privacy', isPrivate?: boolean) {
  const ID = Number(route.params.id)
  updatePost(ID, type, isPrivate)
  switch (type) {
    case 'like':
      post.value!.IsLiked = !post.value!.IsLiked
      post.value!.Like += post.value!.IsLiked ? 1 : -1
      break
    case 'save':
      post.value!.IsSaved = !post.value!.IsSaved
      break
    case 'delete':
      router.push('/')
      break
    case 'comment':
      commentHandler()
      break
    case 'privacy':
      post.value!.IsPrivate = isPrivate ?? !post.value!.IsPrivate
      break
  }
}

onMounted(async () => {
  try {
    const ID = Number(route.params.id)
    const curPost = await getPostByID(ID, userInfo.phone)
    post.value = curPost as Post
    setTitle(post.value.Title)
    await getCommentList()
    await loadLottery()
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
    <DetailCard
      v-if="post"
      :post="post"
      @info-change="infoChange"
    />
    <section v-if="post && lottery" class="lottery-detail-wrap">
      <LotteryDetailBox
        :post-i-d="post.PostID"
        :lottery="lottery"
        @refresh="loadLottery"
      />
    </section>
    <section v-if="post" class="comment-panel mx-a w-15/16">
      <header class="comment-panel__header">
        <h2 class="comment-panel__title">
          评论
          <span class="comment-panel__count">{{ post.Comment }}</span>
        </h2>
        <CommentSortSwitch v-model="commentTimeOrder" />
      </header>
      <CommentCard
        v-for="c in sortedComments"
        :key="c.PcommentID"
        :comment="c"
        :post-id="post.PostID"
        :commentable="true"
        :is-dense="false"
      />
    </section>
  </div>
</template>

<style scoped lang="scss">
.lottery-detail-wrap {
  box-sizing: border-box;
  width: 93.75%;
  max-width: 100%;
  margin: 0 auto;
}

.comment-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 16px 0 12px;
  flex-wrap: nowrap;
}

.comment-panel__title {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.comment-panel__count {
  margin-left: 6px;
  font-size: 0.9rem;
  color: var(--hp-muted, #8a9199);
  font-weight: 500;
}

</style>
