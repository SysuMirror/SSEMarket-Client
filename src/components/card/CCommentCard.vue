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
import BasicInfo from '../BasicInfo.vue'
import MarkdownContainer from '../MarkdownContainer.vue'

import { showMsg } from '../MessageBox'
import UserAvatar from '../UserAvatar.vue'
import CommentToolbar from '../comment/CommentToolbar.vue'

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
const handlerDebounced = debounceAsync(handler)
async function handler(type: 'delete' | 'comment') {
  let event
  switch (type) {
    case 'delete': {
      const result = await deleteFunc()
      if (!result) {
        showMsg('删除失败')
        return
      }
      event = new CustomEvent('comment-handle', {
        bubbles: true,
      })
      break
    }
    case 'comment': {
      commentSubmitting.value = true
      try {
        const result = await sendCommentFunc()
        if (!result) {
          showMsg('评论失败')
          return
        }
        event = new CustomEvent('comment-handle', {
          bubbles: true,
        })
      }
      finally {
        commentSubmitting.value = false
      }
      break
    }
    default:
      return
  }
  root.value?.dispatchEvent(event)
}

async function like() {
  try {
    const res = await likeCommentComment(
      subComment.ccommentID,
      userInfo.phone,
    )
    if (!res) {
      showMsg('点赞失败')
      return
    }
    const event = new CustomEvent('comment-handle', {
      bubbles: true,
    })
    root.value?.dispatchEvent(event)
  }
  catch (e) {
    console.error(e)
    showMsg('失败了:-(')
    return false
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
        @user-action="handlerDebounced"
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
    />
    <CommentToolbar
      inline
      reply-align-end
      :reply-open="commentButtonIsShow"
      :show-sub-toggle="false"
      @toggle-reply="commentButtonIsShow = !commentButtonIsShow"
    >
      <template #leading>
        <BasicInfo
          hide-time
          layout="inline"
          :time="subComment.commentTime"
          :is-like="subComment.isLiked"
          :like="subComment.likeNum"
          nocomment
          @like-change="like"
        />
      </template>
    </CommentToolbar>
    <div v-if="commentButtonIsShow" class="comment-compose">
      <MarkdownEditor
        v-model="commentContent"
        compact
        placeholder="回复 TA…"
        :submit-busy="commentSubmitting"
        @send="handlerDebounced('comment')"
      />
    </div>
    <slot name="showComment" />
  </article>
</template>
