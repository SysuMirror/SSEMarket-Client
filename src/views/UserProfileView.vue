<script setup lang="ts">
import type { AllInfo } from '@/api/info/getInfo'
import type { Post } from '@/types/post'
import { Icon } from '@iconify/vue'
import { computed, nextTick, onBeforeMount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { getUserProfilePostNum, getUserProfilePosts } from '@/api/browse/getUserProfilePosts'
import { getInfoById, normalizeAllInfo } from '@/api/info/getInfo'
import { showMsg } from '@/components/MessageBox'
import PostList from '@/components/PostList.vue'
import { useUserStore } from '@/store/userStore'
import { levelClassHandler, levelExpHandler, levelNameHandler } from '@/utils/level'
import { defaultAvatarFor } from '@/utils/defaultAvatar'
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

const defaultAvatar = computed(() => defaultAvatarFor(user.value?.userID))

const showPostHistory = computed(() => {
  if (!user.value?.userID)
    return false
  if (userInfo.userID === user.value.userID)
    return true
  return !user.value.hideProfilePosts
})

const avatarSrc = computed(() => {
  const u = user.value?.avatarURL?.trim()
  return u || defaultAvatar.value
})

const levelLabel = computed(() => {
  if (!user.value)
    return ''
  return levelNameHandler(user.value.score)
})

const isSelf = computed(() => userInfo.userID === user.value?.userID)

// 币余额仅本人可见（后端只在本人查看时返回 coins）
const showCoins = computed(() => isSelf.value && user.value?.coins !== undefined)
const coinRulesOpen = ref(false)

const expTarget = computed(() => {
  const s = user.value?.score ?? 0
  const n = Number.parseInt(levelExpHandler(s), 10)
  return Number.isFinite(n) && n > 0 ? n : 1
})

const expPercent = computed(() => {
  const s = user.value?.score ?? 0
  return Math.min(100, Math.round((s / expTarget.value) * 1000) / 10)
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
  if (isSelf.value)
    return '我的动态'
  return 'TA 的动态'
})

async function fetchProfilePostTotal() {
  if (!user.value?.userID)
    return
  profileTotal.value = await getUserProfilePostNum(user.value.userID)
}

async function loadMoreProfilePosts() {
  if (!user.value?.userID || profileLoading.value || !profileHasMore.value)
    return
  if (!showPostHistory.value)
    return
  profileLoading.value = true
  const batch = await getUserProfilePosts({
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
  if (!user.value?.userID)
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
  () => [user.value?.userID, user.value?.hideProfilePosts, userInfo.userID] as const,
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
  if (el.src !== defaultAvatar.value)
    el.src = defaultAvatar.value
}
</script>

<template>
  <div v-if="user" class="profile-page">
    <!-- 企业微信风格：顶部藏青色色块 -->
    <div class="profile-banner" />

    <!-- 头像 + 名称区域：半悬浮在 banner 上 -->
    <div class="profile-avatar-zone">
      <img
        class="profile-avatar-zone__img"
        :src="avatarSrc"
        :alt="user.name || '头像'"
        loading="lazy"
        @error="onAvatarError"
      >
      <h1 class="profile-avatar-zone__name">
        {{ user.name || '未命名用户' }}
      </h1>
      <div class="profile-avatar-zone__badges">
        <span class="profile-badge" :class="levelClassHandler(user.score)">{{ levelLabel }}</span>
      </div>
    </div>

    <!-- 操作栏 -->
    <div v-if="!isSelf" class="profile-actions">
      <button type="button" class="profile-actions__btn" @click="navigateChat">
        <Icon icon="tabler:message-circle" width="20" height="20" aria-hidden="true" />
        <span>发私信</span>
      </button>
    </div>

    <!-- 信息卡片：iOS 设置式分组列表 -->
    <div class="profile-group">
      <div v-if="user.intro" class="profile-row">
        <Icon icon="tabler:quote" class="profile-row__icon" width="20" height="20" aria-hidden="true" />
        <div class="profile-row__body">
          <p class="profile-row__label">
            简介
          </p>
          <p class="profile-row__value">
            {{ user.intro }}
          </p>
        </div>
      </div>

      <div class="profile-row">
        <Icon icon="tabler:trophy" class="profile-row__icon" width="20" height="20" aria-hidden="true" />
        <div class="profile-row__body">
          <p class="profile-row__label">
            经验值
          </p>
          <div class="profile-row__exp">
            <span class="profile-row__value">{{ user.score ?? 0 }} / {{ expTarget }}</span>
            <div class="profile-exp-bar">
              <div class="profile-exp-bar__fill" :style="{ width: `${expPercent}%` }" />
            </div>
          </div>
        </div>
      </div>

      <button
        v-if="showCoins"
        type="button"
        class="profile-row profile-row--clickable"
        @click="coinRulesOpen = true"
      >
        <Icon icon="tabler:coin" class="profile-row__icon" width="20" height="20" aria-hidden="true" />
        <div class="profile-row__body">
          <p class="profile-row__label">
            币
          </p>
          <p class="profile-row__value profile-row__value--coin">
            {{ user.coins }} 币 · 点击查看发放规则
          </p>
        </div>
        <Icon icon="tabler:chevron-right" class="profile-row__chevron" width="18" height="18" aria-hidden="true" />
      </button>

      <div class="profile-row">
        <Icon icon="tabler:id-badge-2" class="profile-row__icon" width="20" height="20" aria-hidden="true" />
        <div class="profile-row__body">
          <p class="profile-row__label">
            UID
          </p>
          <p class="profile-row__value">
            {{ user.userID }}
          </p>
        </div>
      </div>
    </div>

    <!-- 动态列表 -->
    <div v-if="showPostHistory" class="profile-posts">
      <div class="profile-posts__head">
        <h2 class="profile-posts__title">
          {{ postsSectionTitle }}
        </h2>
        <span v-if="profileTotal > 0" class="profile-posts__count">{{ profileTotal }} 条</span>
      </div>

      <div v-if="postsEmpty" class="profile-empty">
        <Icon icon="tabler:notes-off" width="36" height="36" aria-hidden="true" />
        <p>还没有帖子</p>
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

    <div v-else class="profile-hidden">
      <Icon icon="tabler:eye-off" width="32" height="32" aria-hidden="true" />
      <p class="profile-hidden__title">
        发帖记录已隐藏
      </p>
      <p class="profile-hidden__hint">
        该用户关闭了动态展示
      </p>
    </div>

    <!-- 币发放规则弹窗 -->
    <div v-if="coinRulesOpen" class="coin-rules-mask" @click.self="coinRulesOpen = false">
      <div class="coin-rules" role="dialog" aria-modal="true" aria-label="币发放规则">
        <h2 class="coin-rules__title">
          <Icon icon="tabler:coin" width="18" height="18" aria-hidden="true" />
          币发放规则
        </h2>
        <ul class="coin-rules__list">
          <li>每天进入网页 <strong>+1 币</strong>（一天一次）</li>
          <li>每天首次发帖 <strong>+1 币</strong></li>
          <li>当天阅读累计满 30 分钟 <strong>+1 币</strong></li>
          <li>当天更新写作满 4000 字 <strong>+1 币</strong></li>
          <li>收到评分：作者 <strong>+1 币</strong>（同一读者对同一本书只算一次）</li>
          <li>投币：每人对每个帖子 / 小说最多 2 币；每投 1 币自己 +10 主页经验</li>
        </ul>
        <p class="coin-rules__note">
          币与小说的经验 / 积分是两条独立的线，不能互相兑换。
        </p>
        <div class="coin-rules__actions">
          <RouterLink class="coin-rules__link" to="/coin" @click="coinRulesOpen = false">
            去币中心看流水
          </RouterLink>
          <button type="button" class="coin-rules__close" @click="coinRulesOpen = false">
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.profile-page {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 0 2rem;
  box-sizing: border-box;
  min-height: 100%;
  color: var(--color-text);
  background: var(--color-bg);
}

/* —— 顶部藏青色 banner —— */
.profile-banner {
  width: 100%;
  height: 120px;
  background: linear-gradient(135deg, var(--accent) 0%, #1e293b 100%);
  flex-shrink: 0;
}

/* —— 头像区域 —— */
.profile-avatar-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: -48px;
  padding: 0 16px;
}

.profile-avatar-zone__img {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid var(--color-card, #fff);
  background: var(--color-bg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.profile-avatar-zone__name {
  margin: 12px 0 6px;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  text-align: center;
  word-break: break-word;
}

.profile-avatar-zone__badges {
  display: flex;
  gap: 6px;
}

.profile-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-full, 999px);
  font-size: 12px;
  font-weight: 500;
  background: var(--accent-soft);
  color: var(--accent);
}

/* —— 操作栏 —— */
.profile-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 16px;
}

.profile-actions__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 24px;
  border-radius: var(--radius-md, 8px);
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s ease;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    background: var(--accent-hover);
  }

  &:active {
    transform: scale(0.98);
  }
}

/* —— iOS 设置式分组列表 —— */
.profile-group {
  background: var(--color-card, #fff);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--color-card-shadow);
  margin: 0 12px 12px;
  overflow: hidden;
}

.profile-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
}

.profile-row__icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.profile-row__body {
  min-width: 0;
  flex: 1;
}

.profile-row__label {
  margin: 0 0 2px;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.profile-row__value {
  margin: 0;
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}

.profile-row__exp {
  display: flex;
  align-items: center;
  gap: 10px;
}

.profile-exp-bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--color-border);
  overflow: hidden;
}

.profile-exp-bar__fill {
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  transition: width 0.3s ease;
}

/* —— 币行（可点击弹规则） —— */
.profile-row--clickable {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    background: var(--accent-soft, rgba(44, 61, 86, 0.05));
  }
}

.profile-row__value--coin {
  color: #b45309;
  font-weight: 600;
}

.profile-row__chevron {
  flex-shrink: 0;
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* —— 币规则弹窗 —— */
.coin-rules-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
}

.coin-rules {
  width: 100%;
  max-width: 420px;
  padding: 16px;
  border-radius: var(--radius-lg, 8px);
  background: var(--color-card, #fff);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
}

.coin-rules__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text, #1e293b);
}

.coin-rules__list {
  margin: 0;
  padding: 0 0 0 18px;
  font-size: 13px;
  line-height: 1.9;
  color: var(--color-text, #1e293b);

  strong {
    color: #b45309;
  }
}

.coin-rules__note {
  margin: 10px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--accent-soft, rgba(44, 61, 86, 0.08));
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-secondary, #475569);
}

.coin-rules__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}

.coin-rules__link {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.coin-rules__close {
  padding: 7px 18px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: var(--radius-md, 8px);
  background: var(--color-card, #fff);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary, #475569);
  cursor: pointer;
  font-family: inherit;

  &:hover {
    background: var(--accent-soft, rgba(44, 61, 86, 0.05));
  }
}

/* —— 动态列表 —— */
.profile-posts {
  padding: 0 12px;
}

.profile-posts__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 4px 8px;
}

.profile-posts__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.profile-posts__count {
  font-size: 13px;
  color: var(--color-text-muted);
}

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
    margin-top: 0 !important;
  }

  :deep(.bottomDiv) {
    padding: 12px 0 6px;
    font-size: 13px;
    color: var(--color-text-muted);
  }
}

.profile-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 2.5rem 1rem;
  color: var(--color-text-muted);

  p {
    margin: 0;
    font-size: 14px;
  }
}

/* —— 隐藏动态 —— */
.profile-hidden {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2.5rem 1.5rem;
  margin: 0 12px;
  background: var(--color-card, #fff);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--color-card-shadow);
  color: var(--color-text-muted);

  .profile-hidden__title {
    margin: 8px 0 4px;
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text);
  }

  .profile-hidden__hint {
    margin: 0;
    font-size: 13px;
    color: var(--color-text-muted);
  }
}

@media screen and (max-width: 480px) {
  .profile-banner {
    height: 100px;
  }

  .profile-avatar-zone__img {
    width: 80px;
    height: 80px;
  }

  .profile-avatar-zone__name {
    font-size: 1.125rem;
  }
}
</style>
