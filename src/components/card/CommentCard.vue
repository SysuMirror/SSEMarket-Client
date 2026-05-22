<script setup lang="ts">
import type { Comment } from '@/types/comment'
import { computed, defineAsyncComponent, nextTick, ref, useTemplateRef, watch } from 'vue'
import { scrollElementBelowHeader } from '@/utils/scrollBelowHeader'
import { delComment, sendPComment } from '@/api/editPostAndComment/editComment'

import { likeRatingComment } from '@/api/rating'
import {
  likePostComment,
} from '@/api/SaveAndLike/SaveAndLike'
import { useUserStore } from '@/store/userStore'
import { debounceAsync } from '@/utils/debounced'
import BasicInfo from '../BasicInfo.vue'

import MarkdownContainer from '../MarkdownContainer.vue'
import { showMsg } from '../MessageBox'
import UserAvatar from '../UserAvatar.vue'
import UserButton from '../UserButton.vue'
import CommentToolbar from '../comment/CommentToolbar.vue'

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

const { userInfo } = useUserStore()

type CommentWithAuthorKeys = Comment & { authorID?: number, author_id?: number }

const commentAuthorProfileId = computed(() => {
  const c = comment as CommentWithAuthorKeys
  const n = Number(c.AuthorID ?? c.authorID ?? c.author_id)
  if (Number.isFinite(n) && n > 0)
    return n
  const phone = (c.AuthorTelephone || '').trim()
  if (phone && userInfo.phone && phone === userInfo.phone.trim() && userInfo.userID > 0)
    return userInfo.userID
  return 0
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

const handlerDebounced = debounceAsync(handler)
async function handler(type: 'delete' | 'comment') {
  let event
  switch (type) {
    case 'delete':{
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
    case 'comment':{
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

async function like() {
  try {
    const res = likeMode === 'rating'
      ? await likeRatingComment(comment.PcommentID)
      : await likePostComment(
          comment.PcommentID,
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
        />
      </div>
      <time class="comment-row__time" :datetime="String(comment.CommentTime)">{{ formattedTime }}</time>
      <UserButton
        compact
        class="comment-row__actions"
        :no-save="true"
        :is-self="userInfo.phone === comment.AuthorTelephone"
        @user-action="handlerDebounced"
      />
    </header>
    <div v-if="$slots['right-extension']" class="rating-display-area">
      <slot name="right-extension" />
    </div>
    <MarkdownContainer
      class="comment-row__body"
      :markdown-content="comment.Content || 'loading'"
    />
    <CommentToolbar
      v-if="commentable"
      inline
      reply-align-end
      :reply-open="commentButtonIsShow"
      :sub-count="comment.SubComments.length"
      :sub-open="showSubComment"
      @toggle-reply="commentButtonIsShow = !commentButtonIsShow"
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
      <MarkdownEditor
        v-model="commentContent"
        compact
        placeholder="写下你的回复…"
        :submit-busy="commentSubmitting"
        @send="handlerDebounced('comment')"
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
