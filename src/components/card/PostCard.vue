<script setup lang="ts">
import type { Post } from '@/types/post'
import { computed } from 'vue'
import { delPost, updatePostPrivacy } from '@/api/editPostAndComment/editPost'

import { likePost, savePost } from '@/api/SaveAndLike/SaveAndLike'
import { showMsg } from '@/components/MessageBox'
import { applyPostMutation, usePostStore } from '@/store/postStore'
import { useUserStore } from '@/store/userStore'
import { debounceAsync } from '@/utils/debounced'
import { isPostOwner } from '@/utils/postOwner'

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

const { updatePost } = usePostStore()

const { userInfo } = useUserStore()

/** 提取帖子预览图：优先 Photos（| 分割），不足时从 Content 提取 markdown 图片 */
const previewImages = computed<string[]>(() => {
  const imgs: string[] = []
  if (post.Photos) {
    imgs.push(...post.Photos.split('|').filter(Boolean))
  }
  if (imgs.length < 9 && post.Content) {
    // 匹配 ![alt](url)，支持跨行 URL
    const mdImgRe = /!\[[^\]]*?\]\(\s*([^)]+?)\s*\)/gs
    let m: RegExpExecArray | null
    while (imgs.length < 9 && (m = mdImgRe.exec(post.Content)) !== null) {
      const url = m[1].trim().replace(/\s+/g, '')
      if (url && !imgs.includes(url))
        imgs.push(url)
    }
  }
  return imgs.slice(0, 9)
})

/** 摘要文本：去掉 markdown 图片语法，只保留纯文本 */
const excerptText = computed(() => {
  const raw = post.Content || ''
  const cleaned = raw.replace(/!\[[^\]]*?\]\([^)]*?\)/g, '').trim()
  return cleaned.slice(0, 100) || 'loading'
})

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
        const { ok, msg, isSaved } = await savePost(
          post.PostID,
          userInfo.phone,
        )
        if (!ok) {
          showMsg(msg || '失败了:-(')
          return
        }
        useCustomEvent('save', isSaved ?? !post.IsSaved)
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

function useCustomEvent(type: 'delete' | 'save' | 'like' | 'privacy', value?: boolean) {
  const synced = type === 'save'
    ? updatePost(post.PostID, type, undefined, value)
    : updatePost(post.PostID, type, value)
  if (!synced && (type === 'like' || type === 'save' || type === 'privacy')) {
    if (type === 'save' && typeof value === 'boolean')
      post.IsSaved = value
    else
      applyPostMutation(post, type, value)
  }
}
</script>

<template>
  <BasicCard class="feed-card post-card" :class="[{ 'post-card--dense': isDense, 'new-post': isNew }]">
    <div v-if="isDense && isSelf" class="post-card__dense-toolbar">
      <UserButton
        class="post-card__toolbar"
        compact
        no-save
        :is-self="true"
        :is-private="!!post.IsPrivate"
        @user-action="handleUserActionDebounce"
      />
    </div>
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
        :is-self="isSelf"
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
        {{ excerptText }}
      </p>
      <div v-if="!isDense && previewImages.length" class="post-card__image-grid" :class="`post-card__image-grid--${Math.min(previewImages.length, 9)}`">
        <img
          v-for="(img, i) in previewImages"
          :key="i"
          :src="img"
          loading="lazy"
          class="post-card__image-item"
          alt=""
        >
      </div>
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
.post-card__dense-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 4px;
}

.post-card__head {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;

  :deep(.user) {
    --userImage: 28px;
    flex: 1;
    min-width: 0;
    width: auto;
    height: auto;
    min-height: var(--userImage);
    font-size: 0.8125rem;
  }

  :deep(.user__cluster) {
    align-items: center;
    gap: 6px;
  }

  :deep(.user-name) {
    font-size: 0.8125rem;
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
  border-radius: var(--radius-sm, 4px);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
}

.post-card__title {
  margin: 0 0 4px;
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--color-text);
}

.post-card__excerpt {
  margin: 0 0 6px;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--color-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

/* 九宫格图片预览 */
.post-card__image-grid {
  display: grid;
  gap: 4px;
  margin: 4px 0 6px;
  width: 100%;
}

/* 1 张：大图 */
.post-card__image-grid--1 {
  grid-template-columns: 1fr;
  max-width: 60%;

  .post-card__image-item {
    aspect-ratio: 4 / 3;
  }
}

/* 2-3 张：一行 */
.post-card__image-grid--2,
.post-card__image-grid--3 {
  grid-template-columns: repeat(var(--cols), 1fr);
}

.post-card__image-grid--2 { --cols: 2; }
.post-card__image-grid--3 { --cols: 3; }

/* 4 张：2x2 */
.post-card__image-grid--4 {
  grid-template-columns: repeat(2, 1fr);
  max-width: 70%;
}

/* 5-6 张：3 列 */
.post-card__image-grid--5,
.post-card__image-grid--6 {
  grid-template-columns: repeat(3, 1fr);
}

/* 7-9 张：3x3 九宫格 */
.post-card__image-grid--7,
.post-card__image-grid--8,
.post-card__image-grid--9 {
  grid-template-columns: repeat(3, 1fr);
}

/* 非 1 张时，正方形 */
.post-card__image-grid:not(.post-card__image-grid--1) .post-card__image-item {
  aspect-ratio: 1 / 1;
}

.post-card__image-item {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-sm, 4px);
  display: block;
}

.post-card--dense .post-card__title-wrap {
  margin-top: 0;
}

.extension-slot {
  position: relative;
}
</style>
