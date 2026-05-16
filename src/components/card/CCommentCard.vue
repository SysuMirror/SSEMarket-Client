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
import BasicCard from './BasicCard.vue'

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

const root = useTemplateRef('root')

/**
 * @description 发送评论
 */
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

/**
 * @description 点赞。
 */
async function like() {
  // 后端没有返回数据，不要赋值后再更新
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
  <BasicCard>
    <div ref="root">
      <div class="c-comment-card__head flex flex-row flex-wrap items-start justify-between gap-2">
        <div class="c-comment-card__profile min-w-0">
          <UserAvatar
            :src="subComment.authorAvatar"
            :user-id="subCommentAuthorProfileId"
            :user-identity="subComment.authorIdentity"
            :user-name="subComment.author"
            :user-score="subComment.authorScore"
          >
            <template #reply>
              <span
                v-if="subComment.hasOwnProperty('userTargetName')"
                class="c-comment-card__reply-label"
              >回复{{ subComment.userTargetName || '层主' }}</span>
            </template>
          </UserAvatar>
        </div>
        <template v-if="subComment.authorTelephone === userInfo.phone">
          <UserButton
            class="flex-shrink-0"
            :no-save="true"
            :is-self="subComment.authorTelephone === userInfo.phone"
            @user-action="handlerDebounced"
          />
        </template>
      </div>
      <MarkdownContainer
        :markdown-content="subComment.content || 'loading'"
      />
      <BasicInfo
        layout="inline"
        :time="subComment.commentTime"
        :is-like="subComment.isLiked"
        :like="subComment.likeNum"
        nocomment
        @like-change="like"
      />
      <CommentToolbar
        :reply-open="commentButtonIsShow"
        :show-sub-toggle="false"
        @toggle-reply="commentButtonIsShow = !commentButtonIsShow"
      />
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
    </div>
  </BasicCard>
</template>

<style scoped>
.c-comment-card__head {
  width: 100%;
}

.c-comment-card__profile {
  flex: 1 1 auto;
  min-width: 0;
}

.c-comment-card__reply-label {
  display: inline-block;
  margin-top: 2px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--chat-text-secondary);
  background: var(--chat-accent-soft);
  word-break: break-word;
}

</style>
