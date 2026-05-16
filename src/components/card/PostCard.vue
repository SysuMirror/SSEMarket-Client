<script setup lang="ts">
import type { Post } from '@/types/post'
import { computed, defineAsyncComponent } from 'vue'

import { delPost } from '@/api/editPostAndComment/editPost'
import { likePost, savePost } from '@/api/SaveAndLike/SaveAndLike'
import { showMsg } from '@/components/MessageBox'
import { usePostStore } from '@/store/postStore'
import { useUserStore } from '@/store/userStore'
import { debounceAsync } from '@/utils/debounced'

import BasicInfo from '../BasicInfo.vue'
import UserAvatar from '../UserAvatar.vue'
import UserButton from '../UserButton.vue'
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
async function handleUserAction(type: 'delete' | 'save') {
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
    }
  }
}

function useCustomEvent(type: 'delete' | 'save' | 'like') {
  updatePost(post.PostID, type)
}
</script>

<template>
  <BasicCard class="post-card" :class="[{ 'post-card--dense': isDense, 'new-post': isNew }]">
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
        :no-save="noSave"
        @user-action="handleUserActionDebounce"
      />
    </div>
    <div class="extension-slot">
      <slot name="right-extension" />
    </div>
    <RouterLink class="post-card__link" :to="`/postdetail/${post.PostID}`">
      <div class="post-card__title-wrap">
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
    />
  </BasicCard>
</template>

<style scoped lang="scss">
.post-card__head {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
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

/* 新帖子 */
.new-post {
  position: relative;
  border-left: 4px solid var(--color-info) !important;
}

.new-post::before {
  content: 'NEW';
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translate(-50%, 0);
  background: var(--color-info);
  color: var(--color-bg);
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  z-index: 10;
  opacity: 0.85;
}

.extension-slot {
  position: relative;
}

@media screen and (min-width: 768px) {
  .post-card:hover {
    box-shadow: var(--color-post-card-hover-box-shadow) 0 4px 12px;
    transform: scale(1.01);
  }
}
</style>
