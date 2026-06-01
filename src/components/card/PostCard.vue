<script setup lang="ts">
import type { Post } from '@/types/post'
import { computed, defineAsyncComponent } from 'vue'

import { delPost, updatePostPrivacy } from '@/api/editPostAndComment/editPost'
import { likePost, savePost } from '@/api/SaveAndLike/SaveAndLike'
import { showMsg } from '@/components/MessageBox'
import { applyPostMutation, usePostStore } from '@/store/postStore'
import { useUserStore } from '@/store/userStore'
import { debounceAsync } from '@/utils/debounced'

import BasicInfo from '../BasicInfo.vue'
import UserAvatar from '../UserAvatar.vue'
import UserButton from '../UserButton.vue'
import VoteLink from '../VoteLink.vue'
import BasicCard from './BasicCard.vue'

const { isDense, post, isNew, noSave = false } = defineProps<{
  isDense?: boolean
  post: Post
  isNew?: boolean
  noSave?: boolean
}>()

type PostWithOwnerKeys = Post & { userID?: number, user_id?: number }

const { updatePost } = usePostStore()
const OldImages = defineAsyncComponent(() => import('@/components/OldImages.vue'))

const { userInfo } = useUserStore()

const profileOwnerId = computed(() => {
  const p = post as PostWithOwnerKeys
  const n = Number(p.UserID ?? p.userID ?? p.user_id)
  if (Number.isFinite(n) && n > 0)
    return n
  const phone = (p.UserTelephone || '').trim()
  if (phone && userInfo.phone && phone === userInfo.phone.trim() && userInfo.userID > 0)
    return userInfo.userID
  return 0
})

async function like() {
  try {
    await likePost(post.PostID, userInfo.phone)
    useCustomEvent('like')
  }
  catch (e) {
    showMsg('失败')
    console.error(e)
  }
}

const handleUserActionDebounce = debounceAsync(handleUserAction)
async function handleUserAction(type: 'delete' | 'save' | 'privacy') {
  switch (type) {
    case 'save': {
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

function useCustomEvent(type: 'delete' | 'save' | 'like' | 'privacy', isPrivate?: boolean) {
  const synced = updatePost(post.PostID, type, isPrivate)
  if (!synced && (type === 'like' || type === 'save' || type === 'privacy'))
    applyPostMutation(post, type, isPrivate)
}
</script>

<template>
  <BasicCard class="post-card feed-card" :class="[{ 'post-card--dense': isDense, 'new-post': isNew }]">
    <div v-show="!isDense" class="post-card__head">
      <UserAvatar
        :src="post.UserAvatar"
        :user-id="profileOwnerId"
        :user-identity="post.UserIdentity"
        :user-name="post.UserName"
        :user-score="post.UserScore"
        :user-phone="post.UserTelephone"
      />
      <UserButton
        class="post-card__toolbar"
        :is-saved="post.IsSaved"
        :is-self="userInfo.phone === post.UserTelephone"
        :is-private="!!post.IsPrivate"
        :no-save="noSave"
        @user-action="handleUserActionDebounce"
      />
    </div>
    <div class="extension-slot">
      <slot name="right-extension" />
    </div>
    <RouterLink class="post-card__link" :to="`/postdetail/${post.PostID}`">
      <div class="post-card__title-wrap">
        <span v-if="post.IsPrivate" class="post-card__private-badge">仅自己可见</span>
        <h3 class="post-card__title">
          {{ post.Title || '' }}
        </h3>
      </div>
      <p v-show="!isDense" class="post-card__excerpt">
        {{ post.Content.slice(0, 15) || 'loading' }}
      </p>
      <template v-if="post.Photos">
        <OldImages :photos="post.Photos" />
      </template>
    </RouterLink>
    <div class="extension-slot">
      <slot name="center-extension" />
    </div>
    <BasicInfo
      :is-dense="isDense"
      :time="post.PostTime"
      :browse="post.Browse"
      :comment="post.Comment"
      :is-like="post.IsLiked"
      :like="post.Like"
      @like-change="like"
    >
      <template v-if="!isDense" #stats-trailing>
        <VoteLink :post-i-d="post.PostID" variant="muted" />
      </template>
    </BasicInfo>
  </BasicCard>
</template>

<style scoped lang="scss">
.post-card__head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;

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

.post-card__toolbar {
  flex-shrink: 0;
}

.post-card__link {
  display: block;
  color: inherit;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}

.post-card__title-wrap {
  margin-top: 2px;
}

.post-card__private-badge {
  display: inline-flex;
  align-items: center;
  margin-bottom: 4px;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--chat-accent-soft);
  color: var(--chat-accent);
  font-size: 11px;
  font-weight: 600;
}

.post-card__title {
  margin: 0 0 4px;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--chat-text);
}

.post-card__excerpt {
  margin: 0 0 6px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--chat-text-secondary);
}

.post-card__excerpt::after {
  content: '...';
}

.post-card--dense .post-card__title-wrap {
  margin-top: 0;
}

/* 新帖子角标 */
.new-post {
  position: relative;
}

.new-post::before {
  content: 'NEW';
  position: absolute;
  top: 6px;
  right: 10px;
  left: auto;
  transform: none;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 6px;
  z-index: 10;
  opacity: 0.95;
}

.extension-slot {
  position: relative;
}

</style>
