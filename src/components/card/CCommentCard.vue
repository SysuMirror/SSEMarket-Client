<script setup lang="ts">
import type { SubComment } from '@/types/comment'
import { computed, defineAsyncComponent, ref, useTemplateRef } from 'vue'
import {
  delCcomment,
  sendPComment,
} from '@/api/editPostAndComment/editComment'
import {
  likeCommentComment,
} from '@/api/SaveAndLike/SaveAndLike'
import { useUserStore } from '@/store/userStore'

import { debounceAsync } from '@/utils/debounced'
import { buildMentionPrefix } from '@/utils/mention'
import BasicInfo from '../BasicInfo.vue'
import CommentToolbar from '../comment/CommentToolbar.vue'

import MarkdownContainer from '../MarkdownContainer.vue'
import { showMsg } from '../MessageBox'
import UserAvatar from '../UserAvatar.vue'

const { subComment, pCommentId, postId } = defineProps<{
  subComment: SubComment
  pCommentId: number
  postId: number
}>()

const UserButton = defineAsyncComponent(() => import('../UserButton.vue'))

const MarkdownEditor = defineAsyncComponent(() => import('../MarkdownEditor.vue'))

const commentButtonIsShow = ref(false)
const commentContent = ref('')
const commentSubmitting = ref(false)

const { userInfo } = useUserStore()

const subCommentAuthorProfileId = computed(() => {
  const s = subComment as SubComment & { AuthorID?: number, author_id?: number }
  const n = Number(s.authorID ?? s.AuthorID ?? s.author_id)
  if (Number.isFinite(n) && n > 0)
    return n
  const phone = (s.authorTelephone || '').trim()
  if (phone && userInfo.phone && phone === userInfo.phone.trim() && userInfo.userID > 0)
    return userInfo.userID
  return 0
})

const extraMentionUsers = computed(() => {
  const list: Array<{ name: string, userID: number }> = []
  const name = (subComment.author || '').trim()
  const id = subCommentAuthorProfileId.value
  if (name && id > 0)
    list.push({ name, userID: id })
  return list
})

const formattedTime = computed(() => {
  return new Date(subComment.commentTime).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
})

const replyTargetLabel = computed(() => {
  if (!subComment.hasOwnProperty('userTargetName'))
    return ''
  return subComment.userTargetName || '层主'
})

const root = useTemplateRef('root')

async function sendCommentFunc() {
  try {
    const sendingData = {
      content: commentContent.value,
      userTelephone: userInfo.phone,
      postID: postId,
      pcommentID: pCommentId,
      userTargetName: subComment.author,
      ccommentID: subComment.ccommentID,
    }

    const res = await sendPComment(sendingData)
    if (res) {
      commentContent.value = ''
      commentButtonIsShow.value = false
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
  const id = subComment.ccommentID
  const res = await delCcomment(id)
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
    showMsg('请输入回复内容')
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

async function like() {
  const prevLiked = subComment.isLiked
  const prevNum = subComment.likeNum
  subComment.isLiked = !subComment.isLiked
  subComment.likeNum += subComment.isLiked ? 1 : -1
  try {
    const res = await likeCommentComment(
      subComment.ccommentID,
      userInfo.phone,
    )
    if (!res) {
      subComment.isLiked = prevLiked
      subComment.likeNum = prevNum
      showMsg('点赞失败')
      return
    }
    root.value?.dispatchEvent(new CustomEvent('comment-handle', {
      bubbles: true,
    }))
  }
  catch (e) {
    subComment.isLiked = prevLiked
    subComment.likeNum = prevNum
    console.error(e)
    showMsg('失败了:-(')
  }
}

function toggleReply() {
  const opening = !commentButtonIsShow.value
  commentButtonIsShow.value = opening
  // 匿名帖作者已被脱敏为「匿名用户」，不预填 @前缀（避免无效提及）
  if (opening && !commentContent.value.trim() && subComment.author !== '匿名用户') {
    const prefix = buildMentionPrefix(subComment.author)
    if (prefix)
      commentContent.value = prefix
  }
}
</script>

<template>
  <article ref="root" class="comment-row comment-row--sub">
    <header class="comment-row__header">
      <div class="comment-row__identity">
        <UserAvatar
          class="comment-row__avatar"
          size="compact"
          :src="subComment.authorAvatar"
          :user-id="subCommentAuthorProfileId"
          :user-phone="subComment.authorTelephone"
          :user-identity="subComment.authorIdentity"
          :user-name="subComment.author"
          :user-score="subComment.authorScore"
        />
      </div>
      <time class="comment-row__time" :datetime="String(subComment.commentTime)">{{ formattedTime }}</time>
      <UserButton
        v-if="subComment.authorTelephone === userInfo.phone"
        compact
        class="comment-row__actions"
        :no-save="true"
        :is-self="true"
        :show-privacy="false"
        @user-action="deleteDebounced"
      />
    </header>
    <div v-if="replyTargetLabel" class="comment-row__meta">
      <span class="comment-row__reply-label">
        回复 {{ replyTargetLabel }}
      </span>
    </div>
    <MarkdownContainer
      class="comment-row__body"
      :markdown-content="subComment.content || 'loading'"
      :extra-mention-users="extraMentionUsers"
    />
    <time class="comment-row__time comment-row__time--mobile" :datetime="String(subComment.commentTime)">{{ formattedTime }}</time>
    <CommentToolbar

      reply-align-end inline
      :reply-open="commentButtonIsShow"
      :show-sub-toggle="false"
      @toggle-reply="toggleReply"
    >
      <template #leading>
        <BasicInfo

          layout="inline"
          :time="subComment.commentTime"
          :is-like="subComment.isLiked"
          :like="subComment.likeNum"
          nocomment hide-time
          @like-change="like"
        />
      </template>
    </CommentToolbar>
    <div v-if="commentButtonIsShow" class="comment-compose">
      <MarkdownEditor
        v-model="commentContent"
        compact
        placeholder="回复 TA…（@昵称+空格 可通知对方）"
        :submit-busy="commentSubmitting"
        @send="submitComment"
      />
    </div>
    <slot name="showComment" />
  </article>
</template>
