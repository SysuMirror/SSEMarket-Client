<script setup lang="ts">
import type { StaffAlias } from '@/api/staff/staff'
import type { Comment } from '@/types/comment'
import { computed, defineAsyncComponent, nextTick, ref, useTemplateRef, watch } from 'vue'
import { trackEvia } from '@/analytics/evia'
import { delComment, sendPComment } from '@/api/editPostAndComment/editComment'
import { likeRatingComment } from '@/api/rating'
import {
  likePostComment,
} from '@/api/SaveAndLike/SaveAndLike'

import { fetchThreadStaffAliases } from '@/composables/useStaffAliases'
import { useUserStore } from '@/store/userStore'
import { debounceAsync } from '@/utils/debounced'
import { buildMentionPrefix } from '@/utils/mention'
import { scrollElementBelowHeader } from '@/utils/scrollBelowHeader'
import BasicInfo from '../BasicInfo.vue'

import CommentToolbar from '../comment/CommentToolbar.vue'
import StaffReplyToggle from '../comment/StaffReplyToggle.vue'
import MarkdownContainer from '../MarkdownContainer.vue'
import { showMsg } from '../MessageBox'
import UserAvatar from '../UserAvatar.vue'
import UserButton from '../UserButton.vue'

const { comment, postId, commentable = true, isDense = false, likeMode = 'post' } = defineProps<{
  comment: Comment
  postId: number
  commentable?: boolean
  isDense?: boolean
  likeMode?: 'post' | 'rating'
}>()

const CCommentCard = defineAsyncComponent(() => import('@/components/card/CCommentCard.vue'))

const MarkdownEditor = defineAsyncComponent(
  () => import('../MarkdownEditor.vue'),
)

const root = useTemplateRef('root')
const subThreadRef = useTemplateRef('subThread')

const commentButtonIsShow = ref(false)
const commentContent = ref('')
const showSubComment = ref(false)
const commentSubmitting = ref(false)

/* 「以职位身份回复」：仅被 @ 的开发人员会拿到非空 aliases（普通用户恒空，UI 不渲染） */
const staffAliases = ref<StaffAlias[]>([])
const staffReplyAs = ref(0)

watch(commentButtonIsShow, async (open) => {
  if (!open || staffAliases.value.length > 0)
    return
  staffAliases.value = await fetchThreadStaffAliases(postId)
})

const { userInfo } = useUserStore()

type CommentWithAuthorKeys = Comment & { authorID?: number, author_id?: number }

/**
 * 是否显示删除入口。
 * 优先用服务端判定的 IsOwn：开发人员「以职位身份」发的评论对外署名是职位小号，
 * 按 phone 比对判不出本人（那样开发人员删不掉自己的回复）。老响应没有该字段时退回 phone 比对。
 */
const canManageComment = computed(() =>
  comment.IsOwn === true || userInfo.phone === comment.AuthorTelephone,
)

const commentAuthorProfileId = computed(() => {
  const c = comment as CommentWithAuthorKeys
  const n = Number(c.AuthorID ?? c.authorID ?? c.author_id)
  if (Number.isFinite(n) && n > 0)
    return n
  return 0
})

const extraMentionUsers = computed(() => {
  const list: Array<{ name: string, userID: number }> = []
  const name = (comment.Author || '').trim()
  const id = commentAuthorProfileId.value
  if (name && id > 0)
    list.push({ name, userID: id })
  return list
})

const formattedTime = computed(() => {
  return new Date(comment.CommentTime).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
})

async function sendCommentFunc() {
  try {
    const sendingData = {
      content: commentContent.value,
      userTelephone: userInfo.phone,
      postID: postId,
      pcommentID: comment.PcommentID,
      asStaffUserID: staffReplyAs.value,
      targetUserID: commentAuthorProfileId.value,
    }

    const res = await sendPComment(sendingData)
    if (res) {
      trackEvia('comment_sent', { post_id: Number(sendingData.postID ?? 0), parent_comment_id: Number(sendingData.pcommentID ?? 0), length_bucket: Math.min(Math.ceil(String(sendingData.content ?? '').length / 50), 20) })
      commentContent.value = ''
      commentButtonIsShow.value = false
      staffReplyAs.value = 0
      return true
    }
    return false
  }
  catch (error) {
    console.error('Error in sendCommentFunc:', error)
    return false
  }
}

async function deleteFunc() {
  const id = comment.PcommentID
  if (!id)
    return
  const res = await delComment(id)
  if (res) {
    return true
  }
  else {
    return false
  }
}

const deleteDebounced = debounceAsync(async () => {
  const result = await deleteFunc()
  if (!result) {
    showMsg('删除失败')
    return
  }
  root.value?.dispatchEvent(new CustomEvent('comment-handle', {
    bubbles: true,
  }))
})

async function submitComment() {
  if (commentSubmitting.value)
    return
  if (!commentContent.value.trim()) {
    showMsg('请输入评论内容')
    return
  }
  commentSubmitting.value = true
  try {
    const result = await sendCommentFunc()
    if (!result) {
      showMsg('评论失败')
      return
    }
    root.value?.dispatchEvent(new CustomEvent('comment-handle', {
      bubbles: true,
    }))
  }
  finally {
    commentSubmitting.value = false
  }
}

async function scrollToFirstSubComment() {
  await nextTick()
  const thread = subThreadRef.value
  if (!thread)
    return
  const first = thread.querySelector('.comment-row--sub') as HTMLElement | null
  scrollElementBelowHeader(first ?? thread, { behavior: 'smooth', extraGap: 12 })
}

watch(showSubComment, (open) => {
  if (open)
    void scrollToFirstSubComment()
})

function toggleReply() {
  const opening = !commentButtonIsShow.value
  commentButtonIsShow.value = opening
  // 匿名帖作者已被脱敏为「匿名用户」，不预填 @前缀（避免无效提及）
  if (opening && !commentContent.value.trim() && comment.Author !== '匿名用户') {
    const prefix = buildMentionPrefix(comment.Author)
    if (prefix)
      commentContent.value = prefix
  }
}

async function like() {
  const prevLiked = comment.IsLiked
  const prevNum = comment.LikeNum
  comment.IsLiked = !comment.IsLiked
  comment.LikeNum += comment.IsLiked ? 1 : -1
  try {
    const res = likeMode === 'rating'
      ? await likeRatingComment(comment.PcommentID)
      : await likePostComment(
          comment.PcommentID,
          userInfo.phone,
        )
    if (!res) {
      comment.IsLiked = prevLiked
      comment.LikeNum = prevNum
      showMsg('点赞失败')
      return
    }
    trackEvia(comment.IsLiked ? 'comment_liked' : 'comment_like_cancelled', { comment_id: Number(comment.PcommentID), level: 1 })
    root.value?.dispatchEvent(new CustomEvent('comment-handle', {
      bubbles: true,
    }))
  }
  catch (e) {
    comment.IsLiked = prevLiked
    comment.LikeNum = prevNum
    console.error(e)
    showMsg('失败了:-(')
  }
}
</script>

<template>
  <article ref="root" class="comment-row">
    <header v-if="!isDense" class="comment-row__header">
      <div class="comment-row__identity">
        <UserAvatar
          class="comment-row__avatar"
          size="compact"
          :src="comment.AuthorAvatar"
          :user-id="commentAuthorProfileId"
          :user-phone="comment.AuthorTelephone"
          :user-identity="comment.AuthorIdentity"
          :user-name="comment.Author"
          :user-score="comment.AuthorScore"
          :user-title="comment.AuthorTitle"
        />
      </div>
      <time class="comment-row__time" :datetime="String(comment.CommentTime)">{{ formattedTime }}</time>
      <UserButton
        compact
        class="comment-row__actions"
        :no-save="true"
        :is-self="canManageComment"
        :show-privacy="false"
        @user-action="deleteDebounced"
      />
    </header>
    <div v-if="$slots['right-extension']" class="rating-display-area">
      <slot name="right-extension" />
    </div>
    <MarkdownContainer
      class="comment-row__body"
      :markdown-content="comment.Content || 'loading'"
      :extra-mention-users="extraMentionUsers"
    />
    <time class="comment-row__time comment-row__time--mobile" :datetime="String(comment.CommentTime)">{{ formattedTime }}</time>
    <CommentToolbar
      v-if="commentable"

      reply-align-end inline
      :reply-open="commentButtonIsShow"
      :sub-count="comment.SubComments.length"
      :sub-open="showSubComment"
      @toggle-reply="toggleReply"
      @toggle-sub="showSubComment = !showSubComment"
    >
      <template #leading>
        <BasicInfo
          hide-time
          layout="inline"
          :time="comment.CommentTime"
          :comment="comment.SubComments.length"
          :nocomment="!commentable"
          :is-like="comment.IsLiked"
          :like="comment.LikeNum"
          @like-change="like"
        />
      </template>
    </CommentToolbar>
    <div v-else class="comment-row__footer">
      <BasicInfo
        hide-time
        layout="inline"
        :time="comment.CommentTime"
        nocomment
        :is-like="comment.IsLiked"
        :like="comment.LikeNum"
        @like-change="like"
      />
    </div>
    <div
      v-if="commentButtonIsShow && commentable"
      class="comment-compose"
    >
      <StaffReplyToggle v-model="staffReplyAs" :aliases="staffAliases" />
      <MarkdownEditor
        v-model="commentContent"
        compact
        placeholder="写下你的回复…（输入 @昵称 可通知对方，后接空格）"
        :submit-busy="commentSubmitting"
        @send="submitComment"
      />
    </div>
    <div
      v-if="comment.SubComments && comment.SubComments.length > 0 && showSubComment"
      ref="subThread"
      class="sub-comments-thread"
    >
      <CCommentCard
        v-for="subComment in comment.SubComments"
        :key="subComment.ccommentID"
        class="w-full"
        :p-comment-id="comment.PcommentID"
        :sub-comment="subComment"
        :post-id="postId"
      />
    </div>
  </article>
</template>
