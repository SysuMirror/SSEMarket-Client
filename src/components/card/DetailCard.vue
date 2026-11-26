<script setup lang="ts">
import type { StaffAlias } from '@/api/staff/staff'
import type { Post } from '@/types/post'
import { computed, defineAsyncComponent, ref, useTemplateRef, watch } from 'vue'
import { trackEvia } from '@/analytics/evia'
import { sendComment } from '@/api/editPostAndComment/editComment'
import { delPost, updatePostPrivacy } from '@/api/editPostAndComment/editPost'

import { likePost, savePost } from '@/api/SaveAndLike/SaveAndLike'
import { showMsg } from '@/components/MessageBox'

import { fetchThreadStaffAliases } from '@/composables/useStaffAliases'
import { useUserStore } from '@/store/userStore'
import { debounceAsync } from '@/utils/debounced'

import { isPostOwner } from '@/utils/postOwner'

import BasicInfo from '../BasicInfo.vue'
import CoinThrowButton from '../CoinThrowButton.vue'
import CommentToolbar from '../comment/CommentToolbar.vue'
import StaffReplyToggle from '../comment/StaffReplyToggle.vue'
import MarkdownContainer from '../MarkdownContainer.vue'
import PostWatchButton from '../PostWatchButton.vue'
import UserAvatar from '../UserAvatar.vue'
import UserButton from '../UserButton.vue'
import BasicCard from './BasicCard.vue'

const { post } = defineProps<{
  post: Post
}>()

const emits = defineEmits<{
  infoChange: [type: 'delete' | 'save' | 'like' | 'privacy', payload?: boolean]
  watchChange: [watched: boolean]
}>()

const OldImages = defineAsyncComponent(() => import('@/components/OldImages.vue'))

const MarkdownEditor = defineAsyncComponent(
  () => import('../MarkdownEditor.vue'),
)

const commentButtonIsShow = ref(false)
const commentContent = ref('')
const commentSubmitting = ref(false)

/* 「以职位身份回复」：仅被 @ 的开发人员会拿到非空 aliases（普通用户恒空，UI 不渲染） */
const staffAliases = ref<StaffAlias[]>([])
const staffReplyAs = ref(0)

watch(commentButtonIsShow, async (open) => {
  if (!open || staffAliases.value.length > 0)
    return
  staffAliases.value = await fetchThreadStaffAliases(Number(post.PostID))
})

const { userInfo } = useUserStore()

const isSelf = computed(() => isPostOwner(post, userInfo))

const profileOwnerId = computed(() => {
  const p = post
  const n = Number(p.UserID ?? (p as { userID?: number }).userID ?? (p as { user_id?: number }).user_id)
  if (Number.isFinite(n) && n > 0)
    return n
  return 0
})

const extraMentionUsers = computed(() => {
  const list: Array<{ name: string, userID: number }> = []
  const name = (post.UserName || '').trim()
  const id = profileOwnerId.value
  if (name && id > 0)
    list.push({ name, userID: id })
  return list
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
    staffReplyAs.value,
  )
  if (res) {
    trackEvia('comment_sent', { post_id: Number(post.PostID), parent_comment_id: 0, length_bucket: Math.min(Math.ceil(commentContent.value.length / 50), 20) })
    commentContent.value = ''
    commentButtonIsShow.value = false
    staffReplyAs.value = 0
    return true
  }
  else {
    return false
  }
}

const handleUserActionDebounce = debounceAsync(handleUserAction)

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
      showMsg('评论失败，请稍后再试')
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

async function handleUserAction(type: 'delete' | 'save' | 'privacy') {
  // 后端没有返回数据，不要赋值后再更新
  switch (type) {
    case 'save':{
      try {
        const { ok, msg, isSaved } = await savePost(
          post.PostID,
          userInfo.phone,
        )
        if (!ok) {
          showMsg(msg || '失败了:-(')
          return
        }
        const nextSaved = isSaved ?? !post.IsSaved
        trackEvia(nextSaved ? 'post_saved' : 'post_save_cancelled', { post_id: post.PostID, from: 'detail' })
        useCustomEvent('save', nextSaved)
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
        trackEvia('post_deleted', { post_id: post.PostID, from: 'detail' })
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
        trackEvia('post_privacy_changed', { post_id: post.PostID, is_private: nextPrivate, from: 'detail' })
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
    const nextLiked = !post.IsLiked
    await likePost(post.PostID, userInfo.phone)
    trackEvia(nextLiked ? 'post_liked' : 'post_like_cancelled', { post_id: post.PostID, from: 'detail' })
    useCustomEvent('like')
  }
  catch (e) {
    showMsg('失败')
    console.error(e)
  }
}

function useCustomEvent(type: 'delete' | 'save' | 'like' | 'privacy', payload?: boolean) {
  emits('infoChange', type, payload)
}
</script>

<template>
  <BasicCard class="detail-card w-15/16">
    <div ref="root" class="detail-card__head">
      <div class="detail-card__profile">
        <UserAvatar
          :src="post.UserAvatar"
          :user-id="profileOwnerId"
          :user-identity="post.UserIdentity"
          :user-name="post.UserName"
          :user-score="post.UserScore"
          :user-title="post.UserTitle"
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
      :extra-mention-users="extraMentionUsers"
    />
    <template v-if="post.Photos">
      <OldImages :photos="post.Photos" />
    </template>
    <BasicInfo
      :time="post.PostTime"
      :browse="post.Browse"
      :comment="post.Comment"
      :is-like="post.IsLiked"
      :like="post.Like"
      @like-change="like"
    />
    <!-- 原版的操作行：投币 | 码住 靠左、写评论靠右（描边药丸）。
         投币排在最左，接在统计行的点赞之后，读起来是「点赞 → 投币 → 码住 → 评论」。 -->
    <CommentToolbar
      reply-label="写评论"
      reply-align-end
      reply-prominent
      no-top-border
      :reply-open="commentButtonIsShow"
      :show-sub-toggle="false"
      @toggle-reply="commentButtonIsShow = !commentButtonIsShow"
    >
      <template #leading>
        <div class="detail-card__leading">
          <CoinThrowButton
            target-type="post"
            :target-i-d="post.PostID"
            :my-coins="post.MyCoins ?? 0"
            :coin-num="post.Coin ?? 0"
            :self="isSelf"
            target-label="帖子"
            variant="prominent"
          />
          <PostWatchButton
            :post-i-d="post.PostID"
            :watched="!!post.IsWatched"
            variant="prominent"
            @watched-change="(w) => emits('watchChange', w)"
          />
        </div>
      </template>
    </CommentToolbar>
    <div v-if="commentButtonIsShow" class="comment-compose max-w-full">
      <StaffReplyToggle v-model="staffReplyAs" :aliases="staffAliases" />
      <MarkdownEditor
        v-model="commentContent"
        compact
        placeholder="写下你的评论…（@昵称+空格 可通知对方）"
        :submit-busy="commentSubmitting"
        @send="submitComment"
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
  border-radius: var(--radius-sm, 4px);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
}

/* 操作行左侧的投币 / 码住：紧凑横排，靠左侧起排（写评论由 CommentToolbar 推到右侧）。
   窄屏放不下时整组换行，不会把写评论挤没。 */
.detail-card__leading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
</style>
