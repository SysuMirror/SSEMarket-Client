<script setup lang="ts">
import type { Post } from '@/types/post'
import { computed, defineAsyncComponent, ref, useTemplateRef } from 'vue'
import { sendComment } from '@/api/editPostAndComment/editComment'
import { delPost, updatePostPrivacy } from '@/api/editPostAndComment/editPost'

import { likePost, savePost } from '@/api/SaveAndLike/SaveAndLike'
import { showMsg } from '@/components/MessageBox'

import { useUserStore } from '@/store/userStore'
import { isPostOwner } from '@/utils/postOwner'

import { debounceAsync } from '@/utils/debounced'

import BasicInfo from '../BasicInfo.vue'
import MarkdownContainer from '../MarkdownContainer.vue'
import UserAvatar from '../UserAvatar.vue'
import UserButton from '../UserButton.vue'
import CommentToolbar from '../comment/CommentToolbar.vue'
import VoteLink from '../VoteLink.vue'
import BasicCard from './BasicCard.vue'

const { post } = defineProps<{
  post: Post
}>()

const emits = defineEmits<{
  infoChange: [type: 'delete' | 'save' | 'like' | 'privacy', isPrivate?: boolean]
}>()

const OldImages = defineAsyncComponent(() => import('@/components/OldImages.vue'))

const MarkdownEditor = defineAsyncComponent(
  () => import('../MarkdownEditor.vue'),
)

const commentButtonIsShow = ref(false)
const commentContent = ref('')
const commentSubmitting = ref(false)

const { userInfo } = useUserStore()

const isSelf = computed(() => isPostOwner(post, userInfo))

const profileOwnerId = computed(() => {
  const p = post
  const n = Number(p.UserID ?? (p as { userID?: number }).userID ?? (p as { user_id?: number }).user_id)
  if (Number.isFinite(n) && n > 0)
    return n
  const phone = (p.UserTelephone || '').trim()
  if (phone && userInfo.phone && phone === userInfo.phone.trim() && userInfo.userID > 0)
    return userInfo.userID
  return 0
})

const root = useTemplateRef('root')
/**
 * @description 发送评论
 */

async function sendCommentFunc() {
  const res = await sendComment(
    commentContent.value,
    Number(post.PostID),
    userInfo.phone,
  )
  if (res) {
    commentContent.value = ''
    commentButtonIsShow.value = false
    return true
  }
  else {
    return false
  }
}

const handlerDebounce = debounceAsync(handler)

async function handler(type: 'comment') {
  let event
  switch (type) {
    case 'comment':{
      commentSubmitting.value = true
      try {
        const result = await sendCommentFunc()
        if (!result) {
          showMsg('评论失败，请稍后再试')
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
      break
  }
  if (!event)
    return
  root.value?.dispatchEvent(event)
}

const handleUserActionDebounce = debounceAsync(handleUserAction)

async function handleUserAction(type: 'delete' | 'save' | 'privacy') {
  // 后端没有返回数据，不要赋值后再更新
  switch (type) {
    case 'save':{
      try {
        await savePost(
          post.PostID,
          userInfo.phone,
        )
        useCustomEvent('save')
      }
      catch (e) {
        console.error(e)
        showMsg('失败了:-(')
      }
      break
    }
    case 'delete': {
      try {
        await delPost(post.PostID)
        useCustomEvent('delete')
      }
      catch (error) {
        console.error(error)
        showMsg('删除失败，请稍后再试')
      }
      break
    }
    case 'privacy': {
      try {
        const nextPrivate = !post.IsPrivate
        await updatePostPrivacy(post.PostID, userInfo.phone, nextPrivate)
        useCustomEvent('privacy', nextPrivate)
        showMsg(nextPrivate ? '已设为仅自己可见' : '已公开')
      }
      catch (error) {
        console.error(error)
        showMsg('设置失败，请稍后再试')
      }
    }
  }
}

/**
 * @description 点赞。
 */
async function like() {
  // 后端没有返回数据，不要赋值后再更新
  try {
    await likePost(post.PostID, userInfo.phone)
    useCustomEvent('like')
  }
  catch (e) {
    showMsg('失败')
    console.error(e)
  }
}

function useCustomEvent(type: 'delete' | 'save' | 'like' | 'privacy', isPrivate?: boolean) {
  emits('infoChange', type, isPrivate)
}
</script>

<template>
  <BasicCard class="w-15/16">
    <div ref="root" class="detail-card__head">
      <div class="detail-card__profile">
        <UserAvatar
          :src="post.UserAvatar"
          :user-id="profileOwnerId"
          :user-identity="post.UserIdentity"
          :user-name="post.UserName"
          :user-score="post.UserScore"
        />
      </div>
      <UserButton
        class="detail-card__toolbar"
        compact
        :is-saved="post.IsSaved"
        :is-self="isSelf"
        :is-private="!!post.IsPrivate"
        @user-action="handleUserActionDebounce"
      />
    </div>
    <div class="extension-slot">
      <slot name="right-extension" />
    </div>
    <div
      class="card-title"
    >
      <span v-if="post.IsPrivate" class="detail-card__private-badge">仅自己可见</span>
      <h2>
        {{ post.Title || '' }}
      </h2>
    </div>
    <MarkdownContainer
      :markdown-content="post.Content || 'loading'"
    />
    <template v-if="post.Photos">
      <OldImages :photos="post.Photos" />
    </template>
    <BasicInfo :time="post.PostTime" :browse="post.Browse" :comment="post.Comment" :is-like="post.IsLiked" :like="post.Like" @like-change="like" />
    <CommentToolbar
      reply-label="写评论"
      reply-prominent
      reply-align-end
      no-top-border
      :reply-open="commentButtonIsShow"
      :show-sub-toggle="false"
      @toggle-reply="commentButtonIsShow = !commentButtonIsShow"
    >
      <template #leading>
        <VoteLink :post-i-d="post.PostID" variant="prominent" />
      </template>
    </CommentToolbar>
    <div v-if="commentButtonIsShow" class="comment-compose max-w-full">
      <MarkdownEditor
        v-model="commentContent"
        compact
        placeholder="写下你的评论…"
        :submit-busy="commentSubmitting"
        @send="handlerDebounce('comment')"
      />
    </div>
  </BasicCard>
</template>

<style scoped lang="scss">
/* 头像与操作按钮同一行：垂直居中，按钮靠右 */
.detail-card__head {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  margin-bottom: 4px;
}

.detail-card__profile {
  flex: 1 1 auto;
  min-width: 0;

  :deep(.user) {
    flex: 1;
    min-width: 0;
    width: auto;
    height: auto;
    min-height: var(--userImage, 50px);
  }

  :deep(.user__cluster) {
    align-items: center;
  }
}

.detail-card__toolbar {
  flex-shrink: 0;
  align-self: center;
}

/* 扩展插槽定位 */
.extension-slot {
  position: relative;
}

.card-title {
  margin-top: 10px;
  margin-bottom: 8px;
}

.detail-card__private-badge {
  display: inline-flex;
  align-items: center;
  margin-bottom: 6px;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--chat-accent-soft);
  color: var(--chat-accent);
  font-size: 12px;
  font-weight: 600;
}
</style>
