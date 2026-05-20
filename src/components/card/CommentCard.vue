<script setup lang="ts">
import type { Comment } from '@/types/comment'
import { computed, defineAsyncComponent, ref, useTemplateRef } from 'vue'
import { delComment, sendPComment } from '@/api/editPostAndComment/editComment'

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
import BasicCard from './BasicCard.vue'

const { comment, postId, commentable = true, isDense = false } = defineProps<{
  comment: Comment
  postId: number
  commentable?: boolean// 是否可再评论
  isDense?: boolean// 是否密集排列(隐藏用户信息)
}>()

const CCommentCard = defineAsyncComponent(() => import('@/components/card/CCommentCard.vue'))

const MarkdownEditor = defineAsyncComponent(
  () => import('../MarkdownEditor.vue'),
)

const root = useTemplateRef('root')

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

/**
 * @description 发送评论
 */

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

/**
 * @description 点赞。
 */
async function like() {
  // 后端没有返回数据，不要赋值后再更新
  try {
    const res = await likePostComment(
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
  <BasicCard>
    <div ref="root">
      <header v-if="!isDense" class="comment-card__header">
        <div class="comment-card__identity">
          <UserAvatar
            class="comment-card__avatar"
            size="compact"
            :src="comment.AuthorAvatar"
            :user-id="commentAuthorProfileId"
            :user-phone="comment.AuthorTelephone"
            :user-identity="comment.AuthorIdentity"
            :user-name="comment.Author"
            :user-score="comment.AuthorScore"
          />
        </div>
        <UserButton
          compact
          class="comment-card__actions"
          :no-save="true"
          :is-self="userInfo.phone === comment.AuthorTelephone"
          @user-action="handlerDebounced"
        />
      </header>
      <p v-if="!isDense" class="comment-card__time">
        {{ formattedTime }}
      </p>
      <!-- 评分显示区域 -->
      <div v-if="$slots['right-extension']" class="rating-display-area">
        <slot name="right-extension" />
      </div>
      <MarkdownContainer
        class="comment-card__body"
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
      <BasicInfo
        v-else
        hide-time
        layout="inline"
        :time="comment.CommentTime"
        nocomment
        :is-like="comment.IsLiked"
        :like="comment.LikeNum"
        @like-change="like"
      />
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
        v-if="comment.SubComments && comment.SubComments.length > 0"
        v-show="showSubComment"
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
    </div>
  </BasicCard>
</template>

<style scoped lang="scss">
.comment-card__header {
  --comment-avatar-size: 40px;
  --comment-avatar-gap: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
}

.comment-card__identity {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.comment-card__avatar {
  flex: 0 0 auto;
}

.comment-card__avatar :deep(.user) {
  width: auto;
  max-width: 100%;
}

.comment-card__actions {
  flex-shrink: 0;
  align-self: flex-start;
}

.comment-card__time {
  margin: 0 0 8px;
  padding-left: calc(var(--comment-avatar-size) + var(--comment-avatar-gap));
  font-size: 11px;
  line-height: 1.3;
  color: var(--chat-text-tips);
}

.comment-card__body {
  margin-bottom: 2px;
}

.rating-display-area {
  margin: 6px 0;
  padding: 2px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

body.dark-mode .default-avatar {
  filter: invert(0.9);
}
</style>
