<script setup lang="ts">
import type { UserSearchPostCard, UserSearchUser } from '@/api/search/searchUsers'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { defaultAvatarFor } from '@/utils/defaultAvatar'
import { levelNameHandler } from '@/utils/level'
import { formatCount, formatNovelTime } from '@/utils/novelText'

const props = defineProps<{
  user: UserSearchUser
}>()

const router = useRouter()

const avatar = computed(() => props.user.avatarURL?.trim() || defaultAvatarFor(props.user.userID))
// B 站式等级徽标只显示「Lv3」；完整等级名留给个人主页。
const levelText = computed(() => levelNameHandler(props.user.score ?? 0).split(' ')[0] || 'Lv0')
const reasonText = computed(() => {
  if (props.user.matchType === 'semantic')
    return `资料相关度 ${Math.round((props.user.relevance ?? 0) * 100)}%`
  if (props.user.matchType === 'intro')
    return '简介匹配'
  return ''
})
const metaText = computed(() => {
  const parts = [`${props.user.postCount} 个帖子`, `${props.user.receivedLikeNum ?? 0} 获赞`]
  return parts.join(' · ')
})

function goProfile() {
  if (props.user.userID > 0)
    void router.push({ name: 'UserProfile', params: { id: String(props.user.userID) } })
}

function goPost(postID: number) {
  if (postID > 0)
    void router.push({ name: 'Postdetail', params: { id: String(postID) } })
}

function onAvatarError(event: Event) {
  const img = event.target as HTMLImageElement
  const fallback = defaultAvatarFor(props.user.userID)
  if (img.src !== fallback)
    img.src = fallback
}

/** 帖子配图字段是 `url1|url2`；缩略图只取第一张。 */
function coverOf(post: UserSearchPostCard): string {
  const first = (post.photos || '').split('|').map(s => s.trim()).find(Boolean)
  return first || ''
}
</script>

<template>
  <article class="user-card">
    <header class="user-card__head">
      <img
        class="user-card__avatar"
        :src="avatar"
        :alt="`${user.name} 的头像`"
        loading="lazy"
        @error="onAvatarError"
        @click="goProfile"
      >
      <div class="user-card__meta">
        <div class="user-card__name-row">
          <button type="button" class="user-card__name" @click="goProfile">
            {{ user.name }}
          </button>
          <span class="user-card__level">{{ levelText }}</span>
        </div>
        <p class="user-card__stats">
          {{ metaText }}
          <span v-if="user.intro" class="user-card__intro">· {{ user.intro }}</span>
        </p>
        <p v-if="reasonText" class="user-card__reason">
          <Icon icon="tabler:sparkles" width="12" height="12" aria-hidden="true" />
          {{ reasonText }}
        </p>
      </div>
      <button type="button" class="user-card__profile-btn" @click="goProfile">
        查看主页
      </button>
    </header>

    <div v-if="user.hidden" class="user-card__hidden">
      <Icon icon="tabler:eye-off" width="18" height="18" aria-hidden="true" />
      <span>用户隐藏了历史对话</span>
    </div>

    <template v-else-if="user.posts.length">
      <div class="user-card__posts">
        <button
          v-for="post in user.posts"
          :key="post.postID"
          type="button"
          class="user-card__post"
          @click="goPost(post.postID)"
        >
          <span class="user-card__thumb">
            <img
              v-if="coverOf(post)"
              :src="coverOf(post)"
              alt=""
              loading="lazy"
            >
            <span v-else class="user-card__thumb-fallback">
              {{ post.title || post.partition || '帖子' }}
            </span>
          </span>
          <span class="user-card__post-title">{{ post.title || '无标题' }}</span>
          <span class="user-card__post-meta">
            {{ formatCount(post.browseNum) }} 浏览 · {{ formatNovelTime(post.postTime) }}
          </span>
        </button>
      </div>
      <button type="button" class="user-card__all" @click="goProfile">
        查看全部 {{ user.postCount }} 个帖子
        <Icon icon="tabler:chevron-right" width="14" height="14" aria-hidden="true" />
      </button>
    </template>

    <div v-else class="user-card__empty">
      暂无公开帖子
    </div>
  </article>
</template>

<style scoped lang="scss">
.user-card {
  padding: 14px;
  border: 1px solid var(--chat-border);
  border-radius: var(--radius-lg, 14px);
  background: var(--color-card, #fff);
  box-shadow: var(--color-card-shadow, 0 2px 10px rgba(15, 23, 42, 0.05));
  color: var(--chat-text);
}

.user-card__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.user-card__avatar {
  flex: none;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  cursor: pointer;
  background: var(--chat-bg-elevated);
}

.user-card__meta {
  flex: 1;
  min-width: 0;
}

.user-card__name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.user-card__name {
  padding: 0;
  border: 0;
  background: none;
  color: var(--chat-text);
  font-size: 1rem;
  font-weight: 700;
  font-family: inherit;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;

  &:hover {
    color: var(--chat-accent);
  }
}

.user-card__level {
  flex: none;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--chat-accent) 12%, transparent);
  color: var(--chat-accent);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
}

.user-card__stats {
  margin: 3px 0 0;
  overflow: hidden;
  color: var(--chat-text-secondary);
  font-size: 0.8125rem;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-card__intro {
  color: var(--chat-text-tips);
}

.user-card__reason {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin: 4px 0 0;
  color: var(--chat-text-tips);
  font-size: 0.75rem;
}

.user-card__profile-btn {
  flex: none;
  padding: 5px 14px;
  border: 1px solid var(--chat-accent);
  border-radius: var(--radius-full, 999px);
  background: var(--chat-accent);
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    filter: brightness(1.06);
  }
}

.user-card__posts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.user-card__post {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.user-card__thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--chat-bg-elevated), var(--chat-bg-highlight));

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.user-card__thumb-fallback {
  display: -webkit-box;
  overflow: hidden;
  padding: 6px 8px;
  color: var(--chat-text-tips);
  font-size: 0.75rem;
  line-height: 1.35;
  text-align: center;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.user-card__post-title {
  overflow: hidden;
  color: var(--chat-text);
  font-size: 0.8125rem;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-card__post-meta {
  overflow: hidden;
  color: var(--chat-text-tips);
  font-size: 0.6875rem;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-card__all {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  margin-top: 6px;
  padding: 7px 0 0;
  border: 0;
  border-top: 1px solid var(--chat-border);
  background: none;
  color: var(--chat-text-secondary);
  font-size: 0.8125rem;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    color: var(--chat-accent);
  }
}

.user-card__hidden,
.user-card__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
  padding: 16px 10px;
  border-radius: 10px;
  background: var(--chat-bg-highlight);
  color: var(--chat-text-secondary);
  font-size: 0.8125rem;
}

.user-card__empty {
  color: var(--chat-text-tips);
}

@media screen and (max-width: 480px) {
  .user-card {
    padding: 12px;
  }

  .user-card__avatar {
    width: 48px;
    height: 48px;
  }

  .user-card__profile-btn {
    padding: 4px 10px;
    font-size: 0.75rem;
  }

  .user-card__stats {
    white-space: normal;
  }
}
</style>
