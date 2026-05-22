<script setup lang="ts">
import type { AllInfo } from '@/api/info/getInfo'
import type { Post } from '@/types/post'
import { Icon } from '@iconify/vue'
import { computed, nextTick, onBeforeMount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getUserProfilePostNum, getUserProfilePosts } from '@/api/browse/getUserProfilePosts'
import { getInfoById, normalizeAllInfo } from '@/api/info/getInfo'
import { showMsg } from '@/components/MessageBox'
import PostList from '@/components/PostList.vue'
import { useUserStore } from '@/store/userStore'
import { levelClassHandler, levelNameHandler } from '@/utils/level'
import { setWindowScrollY } from '@/utils/windowScroll'

const PAGE_SIZE = 15

const router = useRouter()
const route = useRoute()

const user = ref<AllInfo>()
const { userInfo } = useUserStore()

const profilePosts = ref<Post[]>([])
const profileOffset = ref(0)
const profileHasMore = ref(true)
const profileLoading = ref(false)
const profileTotal = ref(0)

const defaultAvatar = `${import.meta.env.BASE_URL}default-avatar.svg`

const showPostHistory = computed(() => {
  if (!user.value?.userID)
    return false
  if (userInfo.userID === user.value.userID)
    return true
  return !user.value.hideProfilePosts
})

const avatarSrc = computed(() => {
  const u = user.value?.avatarURL?.trim()
  return u || defaultAvatar
})

const levelLabel = computed(() => {
  if (!user.value)
    return ''
  return levelNameHandler(user.value.score)
})

const postsEmpty = computed(() => {
  return (
    showPostHistory.value
    && !profileLoading.value
    && profilePosts.value.length === 0
    && !profileHasMore.value
  )
})

const postsSectionTitle = computed(() => {
  if (userInfo.userID === user.value?.userID)
    return '我的动态'
  return 'TA 的动态'
})

async function fetchProfilePostTotal() {
  if (!user.value?.userID || !userInfo.phone)
    return
  profileTotal.value = await getUserProfilePostNum(userInfo.phone, user.value.userID)
}

async function loadMoreProfilePosts() {
  if (!user.value?.userID || !userInfo.phone || profileLoading.value || !profileHasMore.value)
    return
  if (!showPostHistory.value)
    return
  profileLoading.value = true
  const batch = await getUserProfilePosts({
    userTelephone: userInfo.phone,
    targetUserID: user.value.userID,
    limit: PAGE_SIZE,
    offset: profileOffset.value,
  })
  profilePosts.value.push(...batch)
  profileOffset.value += batch.length
  if (batch.length < PAGE_SIZE)
    profileHasMore.value = false
  else if (profileTotal.value > 0 && profilePosts.value.length >= profileTotal.value)
    profileHasMore.value = false
  profileLoading.value = false
}

async function resetAndLoadPosts() {
  profilePosts.value = []
  profileOffset.value = 0
  profileHasMore.value = true
  profileTotal.value = 0
  if (!user.value?.userID || !userInfo.phone)
    return
  if (!showPostHistory.value)
    return
  await fetchProfilePostTotal()
  if (profileTotal.value === 0) {
    profileHasMore.value = false
    return
  }
  await loadMoreProfilePosts()
}

watch(
  () => [user.value?.userID, user.value?.hideProfilePosts, userInfo.userID, userInfo.phone] as const,
  () => {
    void resetAndLoadPosts()
  },
)

onBeforeMount(() => {
  const id = Number(route.params.id)
  getInfoById(id)
    .then((res) => {
      user.value = normalizeAllInfo(res)
    })
    .catch((error: { response?: { msg: string, code: number } }) => {
      if (error.response) {
        const res = error.response
        showMsg(`请求无效：${res.msg} (${res.code})`)
      }
      else {
        showMsg('请求无效')
      }
    })
})

watch(
  () => route.params.id,
  () => {
    void nextTick(() => setWindowScrollY(0))
  },
)

function navigateChat() {
  if (user.value && user.value.userID > 0) {
    router.push({ name: 'Messages', query: { tab: 'chat', user: String(user.value.userID) } })
  }
}

function onAvatarError(e: Event) {
  const el = e.target as HTMLImageElement
  if (el.src !== defaultAvatar)
    el.src = defaultAvatar
}
</script>

<template>
  <div v-if="user" class="profile-page">
    <header class="profile-page__head">
      <div class="profile-page__title-row">
        <Icon icon="tabler:user-circle" class="profile-page__title-icon" width="22" height="22" aria-hidden="true" />
        <h1 class="profile-page__title">
          个人主页
        </h1>
      </div>
      <p class="profile-page__subtitle">
        资料与互动
      </p>
    </header>

    <!-- 顶部身份区：大头像 + 排版层次，弱化「盒子套盒子」 -->
    <section class="profile-sheet profile-sheet--hero" aria-label="用户资料">
      <div class="profile-identity">
        <div class="profile-identity__avatar-wrap">
          <img
            class="profile-identity__avatar"
            :src="avatarSrc"
            :alt="user.name || '头像'"
            loading="lazy"
            @error="onAvatarError"
          >
        </div>
        <div class="profile-identity__main">
          <h2 class="profile-identity__name">
            {{ user.name || '未命名用户' }}
          </h2>
          <div class="profile-identity__chips">
            <span
              class="profile-chip"
              :class="levelClassHandler(user.score)"
            >{{ levelLabel }}</span>
            <span class="profile-chip profile-chip--muted">经验 {{ user.score ?? 0 }}</span>
          </div>
        </div>
      </div>

      <button
        v-if="userInfo.userID !== user.userID"
        type="button"
        class="profile-dm profile-dm--full"
        @click="navigateChat"
      >
        <Icon icon="tabler:message-circle" width="18" height="18" aria-hidden="true" />
        发私信
      </button>
    </section>

    <!-- 简介：分组列表式，无图标标题栏 -->
    <section class="profile-sheet profile-sheet--intro" aria-label="个人简介">
      <p class="profile-overline">
        简介
      </p>
      <p class="profile-intro-body">
        {{ user.intro || '暂无简介' }}
      </p>
    </section>

    <!-- 动态：单卡片容器 + 内嵌 feed，避免与帖子卡片「双重边框」 -->
    <section v-if="showPostHistory" class="profile-posts" aria-label="历史发帖">
      <div class="profile-posts__head">
        <h2 class="profile-posts__title">
          {{ postsSectionTitle }}
        </h2>
        <span v-if="profileTotal > 0" class="profile-posts__count">{{ profileTotal }} 条</span>
      </div>

      <div class="lite-scrollbar profile-feed-wrap">
        <div v-if="postsEmpty" class="profile-feed-empty">
          <Icon icon="tabler:notes-off" class="profile-feed-empty__icon" width="44" height="44" aria-hidden="true" />
          <p class="profile-feed-empty__title">
            还没有帖子
          </p>
          <p class="profile-feed-empty__hint">
            发布的内容会出现在这里
          </p>
        </div>
        <div v-else class="profile-feed">
          <PostList
            :posts="profilePosts"
            post-type="post"
            :is-dense="true"
            :is-loading="profileLoading"
            :has-more="profileHasMore"
            @bottom="loadMoreProfilePosts"
          />
        </div>
      </div>
    </section>

    <section
      v-else
      class="profile-private"
      aria-label="发帖记录已隐藏"
    >
      <Icon icon="tabler:eye-off" class="profile-private__icon" width="40" height="40" aria-hidden="true" />
      <p class="profile-private__title">
        发帖记录已隐藏
      </p>
      <p class="profile-private__hint">
        该用户在设置中关闭了个人主页的动态展示
      </p>
    </section>
  </div>
</template>

<style scoped lang="scss">
.profile-page {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 14px 2rem;
  box-sizing: border-box;
  min-height: 100%;
  color: var(--chat-text);
  background: linear-gradient(180deg, var(--chat-accent-soft) 0%, var(--chat-bg-main) 140px, var(--chat-bg-main) 100%);
}

.profile-page__head {
  margin-bottom: 1rem;
}

.profile-page__title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.profile-page__title-icon {
  color: var(--chat-accent);
  flex-shrink: 0;
}

.profile-page__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--chat-text);
}

.profile-page__subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.875rem;
  color: var(--chat-text-secondary);
}

/* 统一「纸张」卡片：大圆角、轻阴影，接近 iOS / 鸿蒙分组质感 */
.profile-sheet {
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 20px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  margin-bottom: 12px;
}

.profile-sheet--hero {
  padding: 20px 18px 18px;
}

.profile-sheet--intro {
  padding: 16px 18px 18px;
}

.profile-identity {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.profile-identity__avatar-wrap {
  flex-shrink: 0;
  padding: 3px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--chat-accent-soft), transparent);
}

.profile-identity__avatar {
  display: block;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--chat-bg-main);
  border: 2px solid var(--chat-bg-highlight);
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.08);
}

.profile-identity__main {
  min-width: 0;
  flex: 1;
}

.profile-identity__name {
  margin: 0 0 8px;
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--chat-text);
  word-break: break-word;
}

.profile-identity__chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.profile-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  background: var(--chat-bg-main);
  border: 1px solid var(--chat-border);
  color: var(--chat-text-secondary);

  &--muted {
    font-weight: 500;
    color: var(--chat-text-tips);
    border-style: dashed;
  }
}

.profile-dm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 11px 18px;
  border-radius: 14px;
  border: 1px solid var(--chat-border-strong);
  background: var(--chat-bg-main);
  color: var(--chat-accent);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    background: var(--chat-accent-soft);
    border-color: var(--chat-accent);
  }

  &:active {
    transform: scale(0.99);
  }
}

.profile-overline {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--chat-text-tips);
}

.profile-intro-body {
  margin: 0;
  font-size: 15px;
  line-height: 1.65;
  color: var(--chat-text-secondary);
  word-break: break-word;
  white-space: pre-wrap;
}

/* 动态区块：标题条 + 内容井 */
.profile-posts {
  margin-top: 4px;
}

.profile-posts__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin: 0 4px 10px;
  padding: 0 2px;
}

.profile-posts__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--chat-text);
  letter-spacing: 0.01em;
}

.profile-posts__count {
  font-size: 13px;
  font-weight: 500;
  color: var(--chat-text-tips);
  white-space: nowrap;
}

.profile-feed-wrap {
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 20px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  padding: 8px 10px 10px;
  overflow: hidden;
}

.profile-feed-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.25rem;
  text-align: center;
}

.profile-feed-empty__icon {
  color: var(--chat-text-tips);
  opacity: 0.45;
  margin-bottom: 10px;
}

.profile-feed-empty__title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 600;
  color: var(--chat-text);
}

.profile-feed-empty__hint {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--chat-text-secondary);
}

/* 收紧 PostList 外边距，使列表像小红书信息流 */
.profile-feed {
  :deep(.mx-a) {
    margin-left: 0 !important;
    margin-right: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  :deep(.my-2) {
    margin-top: 6px !important;
    margin-bottom: 6px !important;
  }

  :deep(.my-2:first-child) {
    margin-top: 2px !important;
  }

  :deep(.bottomDiv) {
    padding: 14px 0 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--chat-text-tips);
  }
}

.profile-private {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2.5rem 1.5rem;
  background: var(--chat-bg-highlight);
  border: 1px dashed var(--chat-border);
  border-radius: 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.profile-private__icon {
  color: var(--chat-text-tips);
  opacity: 0.5;
  margin-bottom: 12px;
}

.profile-private__title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 600;
  color: var(--chat-text);
}

.profile-private__hint {
  margin: 0;
  max-width: 280px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--chat-text-secondary);
}

.lite-scrollbar {
  overflow: visible;
}

@media screen and (max-width: 480px) {
  .profile-identity__name {
    font-size: 1.25rem;
  }

  .profile-identity__avatar {
    width: 68px;
    height: 68px;
  }
}
</style>
