<script setup lang="ts">
import type { LotteryDetail } from '@/api/lottery/lottery'
import type { Comment } from '@/types/comment'

import type { Post } from '@/types/post'
import type { AssistPostData } from '@/api/assist'
import type { AssistMatchData } from '@/api/assist'
import { fetchAssistMatch, fetchAssistPost } from '@/api/assist'
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getCommentsByPostID } from '@/api/browse/getComment'
import { getPostByID } from '@/api/browse/getPost'
import { getLotteryDetail } from '@/api/lottery/lottery'
import DetailCard from '@/components/card/DetailCard.vue'
import CommentSortSwitch from '@/components/CommentSortSwitch.vue'
import { showImg } from '@/components/ImageShower'
import LotteryDetailBox from '@/components/LotteryDetailBox.vue'
import { showMsg } from '@/components/MessageBox'
import { useNewPostsStore } from '@/store/newPostsStore'
import { usePostStore } from '@/store/postStore'
import { useUserStore } from '@/store/userStore'
import { strHandler } from '@/utils/strHandler'
import { setTitle } from '@/utils/title'

const { updatePost } = usePostStore()
const { removeNewPostId } = useNewPostsStore()

const CommentCard = defineAsyncComponent(() => import('@/components/card/CommentCard.vue'))
const AiPostDetailCard = defineAsyncComponent(() => import('@/components/ai-post-assist/AiPostDetailCard.vue'))

const route = useRoute()
const router = useRouter()
const { userInfo } = useUserStore()

const post = ref<Post>()
const comments = ref<Comment[]>([])
const lottery = ref<LotteryDetail | null>(null)
const aiAssistData = ref<AssistPostData | null>(null)
const aiAssistLoading = ref(false)

// 同一帖子的并发按需生成只跑一次（多标签页/多端同时点开时避免重复调用 LLM）
const assistResolvers = new Map<number, Promise<AssistPostData | null>>()

function toAssistPostData(data: AssistMatchData): AssistPostData {
  return {
    answer: data.answer,
    references: data.references,
    sources_type: data.meta.sources_type ?? 'local',
    web_search_query: null,
    feedback_upvotes: 0,
    feedback_downvotes: 0,
    created_at: null,
  }
}

/**
 * 详情页 AI 回答：自动展示。优先读库内留底；无留底时自动触发生成并落库
 * （同一帖子并发按需生成只跑一次；后端 assist 按 postID 回查帖子分区）。
 * 失败静默，不影响详情页。
 */
async function resolveAssistForPost(p: Post): Promise<void> {
  try {
    const saved = await fetchAssistPost(p.PostID)
    if (saved) {
      aiAssistData.value = saved
      return
    }
  }
  catch {
    return
  }
  aiAssistLoading.value = true
  try {
    let task = assistResolvers.get(p.PostID)
    if (!task) {
      task = fetchAssistMatch(
        { partition: '主页', title: p.Title, content: p.Content, postID: p.PostID },
        AbortSignal.timeout(45_000),
      )
        .then(toAssistPostData)
        .catch(() => null)
      assistResolvers.set(p.PostID, task)
      task.finally(() => assistResolvers.delete(p.PostID))
    }
    aiAssistData.value = await task
  }
  finally {
    aiAssistLoading.value = false
  }
}

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

function infoChange(type: 'like' | 'save' | 'delete' | 'comment' | 'privacy', payload?: boolean) {
  const ID = Number(route.params.id)
  if (type === 'save')
    updatePost(ID, type, undefined, payload)
  else
    updatePost(ID, type, type === 'privacy' ? payload : undefined)
  switch (type) {
    case 'like':
      post.value!.IsLiked = !post.value!.IsLiked
      post.value!.Like += post.value!.IsLiked ? 1 : -1
      break
    case 'save':
      post.value!.IsSaved = payload ?? !post.value!.IsSaved
      break
    case 'delete':
      router.push('/')
      break
    case 'comment':
      commentHandler()
      break
    case 'privacy':
      post.value!.IsPrivate = payload ?? !post.value!.IsPrivate
      break
  }
}

onMounted(async () => {
  try {
    const ID = Number(route.params.id)
    const curPost = await getPostByID(ID, userInfo.phone)
    post.value = curPost as Post
    setTitle(post.value.Title)
    // 加载 AI 回答（无留底时按需生成；与评论/抽奖并行加载，静默失败）
    void resolveAssistForPost(post.value)
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
      @watch-change="(w) => { if (post) post.IsWatched = w }"
    />
    <section v-if="post && lottery" class="lottery-detail-wrap">
      <LotteryDetailBox
        :post-i-d="post.PostID"
        :lottery="lottery"
        @refresh="loadLottery"
      />
    </section>
    <AiPostDetailCard
      v-if="post && aiAssistData"
      :data="aiAssistData"
      :post-id="post.PostID"
    />
    <section
      v-if="post && aiAssistLoading && !aiAssistData"
      class="ai-detail-loading"
    >
      AI 正在汇总站内相关讨论…
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

.ai-detail-loading {
  padding: 14px;
  margin: 12px 0 16px;
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
  background: var(--color-card);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md, 10px);
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
