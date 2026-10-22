<script setup lang="ts">
import type { AssistPostData } from '@/api/assist'
import type { DigestPrefData } from '@/api/digestPref'

import type { LotteryDetail } from '@/api/lottery/lottery'
import type { Comment } from '@/types/comment'
import type { Post } from '@/types/post'
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchAssistPost } from '@/api/assist'
import { getCommentsByPostID } from '@/api/browse/getComment'

import { getPostByID } from '@/api/browse/getPost'
import { getDigestPref } from '@/api/digestPref'
import { getLotteryDetail } from '@/api/lottery/lottery'
import DetailCard from '@/components/card/DetailCard.vue'
import CommentSortSwitch from '@/components/CommentSortSwitch.vue'
import { showImg } from '@/components/ImageShower'
import LotteryDetailBox from '@/components/LotteryDetailBox.vue'
import { showMsg } from '@/components/MessageBox'
import PresenceBadge from '@/components/PresenceBadge.vue'
import { loadStaffAliases } from '@/composables/useStaffAliases'
import { isDigestPrefEnabled } from '@/config/digestPref'
import { useNewPostsStore } from '@/store/newPostsStore'
import { usePostStore } from '@/store/postStore'
import { useUserStore } from '@/store/userStore'
import { strHandler } from '@/utils/strHandler'
import { setTitle } from '@/utils/title'

const { updatePost } = usePostStore()
const { removeNewPostId } = useNewPostsStore()

const CommentCard = defineAsyncComponent(() => import('@/components/card/CommentCard.vue'))
const AiPostDetailCard = defineAsyncComponent(() => import('@/components/ai-post-assist/AiPostDetailCard.vue'))
const DigestPrefModal = defineAsyncComponent(() => import('@/components/DigestPrefModal.vue'))

const route = useRoute()
const router = useRouter()
const { userInfo } = useUserStore()

const post = ref<Post>()
const comments = ref<Comment[]>([])
const lottery = ref<LotteryDetail | null>(null)
const aiAssistData = ref<AssistPostData | null>(null)
const digestBtnVisible = ref(false)
const digestPrefData = ref<DigestPrefData | null>(null)
const showDigestPrefModal = ref(false)

/**
 * 详情页 AI 回答：只读数据库留底，不生成。
 * 生成只发生在两处——发帖后 PostView 自动预生成、pod 常驻补量进程兜底；
 * 这里无留底就什么都不显示，绝不现场触发生成。
 */
async function resolveAssistForPost(p: Post): Promise<void> {
  try {
    const saved = await fetchAssistPost(p.PostID)
    if (saved)
      aiAssistData.value = saved
  }
  catch {
    // 静默：AI 区域不可用不影响详情页
  }
}

/**
 * 日报人工倾向（digest-pref）：非白名单/编译开关关闭时提前返回——
 * 不发任何 digest-pref 请求，弹窗 chunk 由 defineAsyncComponent 惰性加载，
 * 按钮仅在当前帖为最新一期日报帖（daily_post_id 匹配）时出现。
 */
function currentPostId(): number | null {
  const n = Number(route.params.id)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function refreshDigestPref() {
  if (!isDigestPrefEnabled(userInfo.name))
    return
  const data = await getDigestPref()
  digestPrefData.value = data
  const pid = currentPostId()
  digestBtnVisible.value = !!data?.daily_post_id && pid === Number(data.daily_post_id)
}

async function onPrefModalClose() {
  showDigestPrefModal.value = false
  await refreshDigestPref()
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
    // 加载 AI 回答留底（只读，不生成；与评论/抽奖并行加载，静默失败）
    void resolveAssistForPost(post.value)
    // 白名单用户拉取日报倾向状态（决定「调整日报倾向」按钮可见性；静默失败）
    void refreshDigestPref()
    // 预热职位账号缓存：已有评论里的 @iwiki开发人员 直接渲染成职位链接（静默失败）
    void loadStaffAliases()
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
    <div v-if="post" class="post-detail__presence">
      <PresenceBadge scene="post" :target-id="post.PostID" label="正在看" />
    </div>
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
    <button
      v-if="digestBtnVisible"
      class="digest-pref-entry"
      type="button"
      @click="showDigestPrefModal = true"
    >
      调整日报倾向
    </button>
    <DigestPrefModal
      v-if="showDigestPrefModal"
      :data="digestPrefData"
      @close="onPrefModalClose"
    />
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
.post-detail__presence {
  display: flex;
  justify-content: flex-end;
  box-sizing: border-box;
  width: 93.75%;
  max-width: 100%;
  margin: 6px auto 2px;
}

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

.digest-pref-entry {
  /* 右缘与帖卡片内容右缘对齐（卡片 w-15/16 居中 + BasicCard 14px 内边距），正对「展开全部」 */
  align-self: flex-end;
  margin: 0 calc(3.125% + 14px) 16px 0;
  padding: 6px 18px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  color: var(--color-text-secondary);
  background: var(--color-card, #fff);
  border: 1px solid var(--hp-muted, #8a9199);
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    border-color: var(--accent, #6d28d9);
    color: var(--accent, #6d28d9);
  }
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
