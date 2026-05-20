<script setup lang="ts">
import type { UserRankItem, VoteRankItem } from '@/api/vote/vote'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { getPostRanking, getUserRanking } from '@/api/vote/vote'
import { showMsg } from '@/components/MessageBox'

type RankTab = 'post' | 'user'

const activeTab = ref<RankTab>('post')
const postRanking = ref<VoteRankItem[]>([])
const userRanking = ref<UserRankItem[]>([])
const loading = ref(true)
const avatarFailed = ref<Record<number, boolean>>({})

const subtitle = computed(() => {
  if (activeTab.value === 'post')
    return '按得票数排序 · 前 100 名'
  return '获赞与获票合计 · 前 100 名'
})

const currentList = computed(() => {
  return activeTab.value === 'post' ? postRanking.value : userRanking.value
})

const isEmpty = computed(() => !loading.value && currentList.value.length === 0)

const postTopThree = computed(() => postRanking.value.slice(0, 3))
const postRestList = computed(() => postRanking.value.slice(3))
const userTopThree = computed(() => userRanking.value.slice(0, 3))
const userRestList = computed(() => userRanking.value.slice(3))

function rankTier(index: number): 'gold' | 'silver' | 'bronze' | 'default' {
  if (index === 0)
    return 'gold'
  if (index === 1)
    return 'silver'
  if (index === 2)
    return 'bronze'
  return 'default'
}

function rankMedalIcon(index: number) {
  if (index === 0)
    return 'tabler:crown'
  if (index === 1)
    return 'tabler:medal'
  if (index === 2)
    return 'tabler:award'
  return ''
}

function userNameAvatarText(userName: string) {
  const name = userName.trim()
  if (!name)
    return '用'
  const chars = [...name]
  if (/^[\u4E00-\u9FFF]/.test(chars[0]))
    return chars[0]
  if (chars.length >= 2 && /^[a-z]/i.test(chars[0]))
    return (chars[0] + chars[1]).toUpperCase()
  return chars[0].toUpperCase()
}

function displayUserName(item: UserRankItem) {
  return item.userName?.trim() || '匿名用户'
}

function userAvatarSrc(item: UserRankItem) {
  if (avatarFailed.value[item.userID])
    return ''
  const url = item.avatarURL?.trim()
  return url || ''
}

function shouldShowAvatarFallback(item: UserRankItem) {
  return avatarFailed.value[item.userID] || !item.avatarURL?.trim()
}

function onUserAvatarError(userID: number) {
  avatarFailed.value = { ...avatarFailed.value, [userID]: true }
}

function formatCount(n: number) {
  if (n >= 10000)
    return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000)
    return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

async function loadRanking() {
  loading.value = true
  avatarFailed.value = {}
  try {
    if (activeTab.value === 'post')
      postRanking.value = await getPostRanking()
    else
      userRanking.value = await getUserRanking()
  }
  catch (e) {
    console.error(e)
    showMsg('获取排行榜失败')
  }
  finally {
    loading.value = false
  }
}

watch(activeTab, () => {
  loadRanking()
})

onMounted(() => {
  loadRanking()
})
</script>

<template>
  <div class="ranking-page">
    <header class="ranking-page__hero">
      <div class="ranking-page__hero-glow" aria-hidden="true" />
      <div class="ranking-page__hero-inner">
        <div class="ranking-page__hero-top">
          <div class="ranking-page__hero-text">
            <h1 class="ranking-page__title">
              排行榜
            </h1>
            <p class="ranking-page__subtitle">
              {{ subtitle }}
            </p>
          </div>
          <RouterLink to="/vote" class="ranking-page__cta">
            去投票
          </RouterLink>
        </div>

        <div
          class="ranking-page__switch"
          role="tablist"
          aria-label="榜单类型"
        >
          <span
            class="ranking-page__switch-thumb"
            :class="{ 'ranking-page__switch-thumb--user': activeTab === 'user' }"
            aria-hidden="true"
          />
          <button
            type="button"
            class="ranking-page__switch-option"
            :class="{ 'ranking-page__switch-option--active': activeTab === 'post' }"
            role="tab"
            :aria-selected="activeTab === 'post'"
            @click="activeTab = 'post'"
          >
            <Icon icon="tabler:flame" width="16" height="16" aria-hidden="true" />
            优质榜
          </button>
          <button
            type="button"
            class="ranking-page__switch-option"
            :class="{ 'ranking-page__switch-option--active': activeTab === 'user' }"
            role="tab"
            :aria-selected="activeTab === 'user'"
            @click="activeTab = 'user'"
          >
            <Icon icon="tabler:users" width="16" height="16" aria-hidden="true" />
            用户榜
          </button>
        </div>
      </div>
    </header>

    <section class="ranking-page__body" :aria-busy="loading">
      <!-- 骨架屏 -->
      <div v-if="loading" class="ranking-page__loading">
        <div class="ranking-page__podium-skeleton">
          <span v-for="i in 3" :key="i" class="ranking-page__podium-skeleton-card" />
        </div>
        <div class="ranking-page__list-skeleton">
          <div
            v-for="i in 5"
            :key="i"
            class="ranking-page__row-skeleton"
          />
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else-if="isEmpty" class="ranking-page__empty">
        <div class="ranking-page__empty-icon-wrap">
          <Icon icon="tabler:chart-bar-off" width="32" height="32" aria-hidden="true" />
        </div>
        <p class="ranking-page__empty-title">
          暂无数据
        </p>
        <p class="ranking-page__empty-hint">
          投票或互动后，榜单会在这里更新
        </p>
      </div>

      <template v-else>
        <!-- 前三名领奖台 -->
        <div v-if="(activeTab === 'post' ? postTopThree : userTopThree).length" class="ranking-page__podium">
          <template v-if="activeTab === 'post'">
            <RouterLink
              v-for="(item, index) in postTopThree"
              :key="item.postID"
              :to="`/postdetail/${item.postID}`"
              class="ranking-page__podium-card"
              :class="[
                `ranking-page__podium-card--${rankTier(index)}`,
                { 'ranking-page__podium-card--center': index === 0 },
              ]"
            >
              <span class="ranking-page__podium-rank" :class="`ranking-page__podium-rank--${rankTier(index)}`">
                <Icon
                  v-if="rankMedalIcon(index)"
                  :icon="rankMedalIcon(index)"
                  width="14"
                  height="14"
                  aria-hidden="true"
                />
                <span v-else>{{ index + 1 }}</span>
              </span>
              <span class="ranking-page__podium-title">{{ item.title }}</span>
              <span class="ranking-page__podium-stat">
                <Icon icon="tabler:heart-filled" width="12" height="12" aria-hidden="true" />
                {{ formatCount(item.voteCount) }} 票
              </span>
              <span v-if="item.partition" class="ranking-page__podium-tag">{{ item.partition }}</span>
            </RouterLink>
          </template>

          <template v-else>
            <RouterLink
              v-for="(item, index) in userTopThree"
              :key="item.userID"
              :to="`/user/${item.userID}`"
              class="ranking-page__podium-card ranking-page__podium-card--user"
              :class="[
                `ranking-page__podium-card--${rankTier(index)}`,
                { 'ranking-page__podium-card--center': index === 0 },
              ]"
            >
              <span class="ranking-page__podium-rank" :class="`ranking-page__podium-rank--${rankTier(index)}`">
                <Icon
                  v-if="rankMedalIcon(index)"
                  :icon="rankMedalIcon(index)"
                  width="14"
                  height="14"
                  aria-hidden="true"
                />
                <span v-else>{{ index + 1 }}</span>
              </span>
              <span
                class="ranking-page__podium-avatar"
                :class="`ranking-page__podium-avatar--${rankTier(index)}`"
              >
                <img
                  v-if="!shouldShowAvatarFallback(item)"
                  :src="userAvatarSrc(item)"
                  :alt="displayUserName(item)"
                  loading="lazy"
                  @error="onUserAvatarError(item.userID)"
                >
                <span v-else class="ranking-page__podium-avatar-fallback">
                  {{ userNameAvatarText(displayUserName(item)) }}
                </span>
              </span>
              <span class="ranking-page__podium-title">{{ displayUserName(item) }}</span>
              <span class="ranking-page__podium-stat">
                合计 {{ formatCount(item.rankScore) }}
              </span>
            </RouterLink>
          </template>
        </div>

        <!-- 第 4 名起 -->
        <ol v-if="activeTab === 'post' && postRestList.length" class="ranking-page__list">
          <li
            v-for="(item, idx) in postRestList"
            :key="item.postID"
            class="ranking-page__item"
          >
            <RouterLink
              :to="`/postdetail/${item.postID}`"
              class="ranking-page__row"
            >
              <span class="ranking-page__rank-num">{{ idx + 4 }}</span>
              <span class="ranking-page__content">
                <span class="ranking-page__name">{{ item.title }}</span>
                <span class="ranking-page__meta">
                  <span v-if="item.partition" class="ranking-page__tag">
                    {{ item.partition }}
                  </span>
                  <span class="ranking-page__stat">
                    <Icon icon="tabler:heart" width="13" height="13" aria-hidden="true" />
                    {{ formatCount(item.voteCount) }} 票
                  </span>
                </span>
              </span>
              <Icon icon="tabler:chevron-right" class="ranking-page__chevron" width="18" height="18" aria-hidden="true" />
            </RouterLink>
          </li>
        </ol>

        <ol v-else-if="activeTab === 'user' && userRestList.length" class="ranking-page__list">
          <li
            v-for="(item, idx) in userRestList"
            :key="item.userID"
            class="ranking-page__item"
          >
            <RouterLink
              :to="`/user/${item.userID}`"
              class="ranking-page__row"
            >
              <span class="ranking-page__rank-num">{{ idx + 4 }}</span>
              <span class="ranking-page__avatar">
                <img
                  v-if="!shouldShowAvatarFallback(item)"
                  :src="userAvatarSrc(item)"
                  :alt="displayUserName(item)"
                  loading="lazy"
                  @error="onUserAvatarError(item.userID)"
                >
                <span v-else class="ranking-page__avatar-fallback">
                  {{ userNameAvatarText(displayUserName(item)) }}
                </span>
              </span>
              <span class="ranking-page__content">
                <span class="ranking-page__name">{{ displayUserName(item) }}</span>
                <span class="ranking-page__meta">
                  <span class="ranking-page__stat">
                    赞 {{ formatCount(item.receivedLikeNum) }}
                  </span>
                  <span class="ranking-page__stat-divider" aria-hidden="true">·</span>
                  <span class="ranking-page__stat">
                    票 {{ formatCount(item.receivedVoteNum) }}
                  </span>
                  <span class="ranking-page__stat ranking-page__stat--total">
                    合计 {{ formatCount(item.rankScore) }}
                  </span>
                </span>
              </span>
              <Icon icon="tabler:chevron-right" class="ranking-page__chevron" width="18" height="18" aria-hidden="true" />
            </RouterLink>
          </li>
        </ol>
      </template>
    </section>
  </div>
</template>

<style scoped lang="scss">
/* 小红书卡片感 + Apple 留白与圆角 + 华为克制配色 */
.ranking-page {
  --rank-gold: #f5a623;
  --rank-silver: #8e9aaf;
  --rank-bronze: #c77b4a;
  --rank-card-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
  --rank-card-radius: 16px;

  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 16px calc(2rem + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  color: var(--chat-text);
}

.ranking-page__hero {
  position: relative;
  margin: 0 -16px 12px;
  padding: 12px 16px 0;
  overflow: hidden;
}

.ranking-page__hero-glow {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 50% -10%, rgba(var(--chat-accent-rgb, 44, 61, 86), 0.12), transparent 70%),
    linear-gradient(180deg, var(--chat-bg-main) 0%, transparent 100%);
  pointer-events: none;
}

.ranking-page__hero-inner {
  position: relative;
  z-index: 1;
}

.ranking-page__hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ranking-page__hero-text {
  min-width: 0;
  flex: 1;
}

.ranking-page__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--chat-text);
}

.ranking-page__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 400;
  color: var(--chat-text-secondary);
}

/* iOS 风格分段控件 */
.ranking-page__switch {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  height: 40px;
  margin: 10px 0 12px;
  padding: 3px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.05);
  box-sizing: border-box;
}

.ranking-page__switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: calc(50% - 3px);
  height: calc(100% - 6px);
  border-radius: 10px;
  background: #fff;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.08),
    0 0 0 0.5px rgba(0, 0, 0, 0.04);
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
  pointer-events: none;

  &--user {
    transform: translateX(100%);
  }
}

.ranking-page__switch-option {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: none;
  border-radius: 10px;
  background: transparent !important;
  color: var(--chat-text-secondary);
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: color 0.2s ease;
  -webkit-tap-highlight-color: transparent;

  &--active {
    color: var(--chat-text);
    font-weight: 600;
  }
}

/* 领奖台 */
.ranking-page__podium {
  display: grid;
  grid-template-columns: 1fr 1.12fr 1fr;
  gap: 8px;
  align-items: end;
  margin-bottom: 16px;
  min-height: 0;

  /* 领奖台顺序：左银、中金、右铜 */
  .ranking-page__podium-card:nth-child(1) {
    order: 2;
  }

  .ranking-page__podium-card:nth-child(2) {
    order: 1;
  }

  .ranking-page__podium-card:nth-child(3) {
    order: 3;
  }
}

.ranking-page__podium-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 10px 12px;
  text-decoration: none;
  color: inherit;
  background: #fff;
  border-radius: var(--rank-card-radius);
  box-shadow: var(--rank-card-shadow);
  border: 1px solid rgba(0, 0, 0, 0.04);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  min-width: 0;

  &:active {
    transform: scale(0.98);
  }

  &--center {
    padding-top: 18px;
    padding-bottom: 16px;
    transform: translateY(-6px);
    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.1);

    &:active {
      transform: translateY(-6px) scale(0.98);
    }
  }

  &--gold {
    border-color: rgba(245, 166, 35, 0.25);
    background: linear-gradient(180deg, #fffdf7 0%, #fff 40%);
  }

  &--silver {
    border-color: rgba(142, 154, 175, 0.2);
    background: linear-gradient(180deg, #fafbfc 0%, #fff 40%);
  }

  &--bronze {
    border-color: rgba(199, 123, 74, 0.2);
    background: linear-gradient(180deg, #fffaf6 0%, #fff 40%);
  }
}

.ranking-page__podium-rank {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;

  &--gold {
    color: #fff;
    background: linear-gradient(135deg, #f5c842, var(--rank-gold));
    box-shadow: 0 2px 8px rgba(245, 166, 35, 0.4);
  }

  &--silver {
    color: #fff;
    background: linear-gradient(135deg, #b8c4d4, var(--rank-silver));
    box-shadow: 0 2px 6px rgba(142, 154, 175, 0.35);
  }

  &--bronze {
    color: #fff;
    background: linear-gradient(135deg, #d4956a, var(--rank-bronze));
    box-shadow: 0 2px 6px rgba(199, 123, 74, 0.35);
  }
}

.ranking-page__podium-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--chat-bg-main);
  border: 2px solid rgba(0, 0, 0, 0.06);

  .ranking-page__podium-card--center & {
    width: 52px;
    height: 52px;
  }

  &--gold {
    border-color: rgba(245, 166, 35, 0.5);
  }

  &--silver {
    border-color: rgba(142, 154, 175, 0.45);
  }

  &--bronze {
    border-color: rgba(199, 123, 74, 0.45);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.ranking-page__podium-avatar-fallback {
  font-size: 16px;
  font-weight: 600;
  color: var(--chat-text-secondary);
  letter-spacing: 0.02em;

  .ranking-page__podium-card--center & {
    font-size: 18px;
  }
}

.ranking-page__podium-title {
  width: 100%;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  text-align: center;
  color: var(--chat-text);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;

  .ranking-page__podium-card--center & {
    font-size: 13px;
  }
}

.ranking-page__podium-stat {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--chat-text-secondary);
}

.ranking-page__podium-tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 500;
  color: var(--chat-accent);
  background: var(--chat-accent-soft, rgba(44, 61, 86, 0.08));
}

/* 列表 */
.ranking-page__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ranking-page__row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 12px 14px;
  text-decoration: none;
  color: inherit;
  background: #fff;
  border-radius: 14px;
  box-shadow: var(--rank-card-shadow);
  border: 1px solid rgba(0, 0, 0, 0.04);
  transition:
    background 0.15s ease,
    transform 0.15s ease;
  -webkit-tap-highlight-color: transparent;

  &:active {
    transform: scale(0.995);
    background: rgba(0, 0, 0, 0.02);
  }
}

.ranking-page__rank-num {
  flex-shrink: 0;
  width: 28px;
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--chat-text-tips);
}

.ranking-page__avatar {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--chat-bg-main), rgba(0, 0, 0, 0.04));
  border: 1px solid rgba(0, 0, 0, 0.06);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.ranking-page__avatar-fallback {
  font-size: 14px;
  font-weight: 600;
  color: var(--chat-text-secondary);
  letter-spacing: 0.02em;
}

.ranking-page__content {
  min-width: 0;
  flex: 1;
}

.ranking-page__name {
  display: block;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--chat-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking-page__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  margin-top: 3px;
}

.ranking-page__tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  color: var(--chat-accent);
  background: var(--chat-accent-soft, rgba(44, 61, 86, 0.08));
}

.ranking-page__stat {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
  color: var(--chat-text-secondary);

  &--total {
    color: var(--chat-text);
    font-weight: 600;
  }
}

.ranking-page__stat-divider {
  color: var(--chat-text-tips);
  font-size: 10px;
}

.ranking-page__chevron {
  flex-shrink: 0;
  color: var(--chat-text-tips);
  opacity: 0.5;
}

/* 骨架屏 */
.ranking-page__loading {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ranking-page__podium-skeleton {
  display: grid;
  grid-template-columns: 1fr 1.12fr 1fr;
  gap: 8px;
  align-items: end;
}

.ranking-page__podium-skeleton-card {
  height: 120px;
  border-radius: var(--rank-card-radius);
  background: linear-gradient(
    90deg,
    var(--chat-bg-main) 0%,
    rgba(0, 0, 0, 0.04) 50%,
    var(--chat-bg-main) 100%
  );
  background-size: 200% 100%;
  animation: rank-shimmer 1.2s ease-in-out infinite;

  &:nth-child(2) {
    height: 140px;
    animation-delay: 0.1s;
  }

  &:nth-child(3) {
    animation-delay: 0.2s;
  }
}

.ranking-page__list-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ranking-page__row-skeleton {
  height: 64px;
  border-radius: 14px;
  background: linear-gradient(
    90deg,
    var(--chat-bg-main) 0%,
    rgba(0, 0, 0, 0.04) 50%,
    var(--chat-bg-main) 100%
  );
  background-size: 200% 100%;
  animation: rank-shimmer 1.2s ease-in-out infinite;
}

@keyframes rank-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 空状态 */
.ranking-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  text-align: center;
  background: #fff;
  border-radius: var(--rank-card-radius);
  box-shadow: var(--rank-card-shadow);
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.ranking-page__empty-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin-bottom: 14px;
  border-radius: 50%;
  color: var(--chat-text-tips);
  background: var(--chat-bg-main);
}

.ranking-page__empty-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--chat-text);
}

.ranking-page__empty-hint {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--chat-text-secondary);
}

/* 右上角胶囊按钮 */
.ranking-page__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
  min-height: 34px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  text-decoration: none;
  white-space: nowrap;
  color: #fff;
  background: var(--chat-accent);
  border: none;
  border-radius: 999px;
  box-sizing: border-box;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
  transition:
    transform 0.15s ease,
    opacity 0.15s ease;

  &:hover {
    opacity: 0.92;
    color: #fff;
  }

  &:active {
    transform: scale(0.97);
    opacity: 0.88;
  }
}

/* 暗色模式 */
body.dark-mode .ranking-page {
  --rank-card-shadow: 0 2px 16px rgba(0, 0, 0, 0.25);
}

body.dark-mode .ranking-page__switch {
  background: rgba(255, 255, 255, 0.08);
}

body.dark-mode .ranking-page__switch-thumb {
  background: var(--chat-bg-elevated);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

body.dark-mode .ranking-page__podium-card,
body.dark-mode .ranking-page__row,
body.dark-mode .ranking-page__empty {
  background: var(--chat-bg-elevated);
  border-color: var(--chat-border);
}

body.dark-mode .ranking-page__podium-card--gold {
  background: linear-gradient(180deg, rgba(245, 166, 35, 0.12) 0%, var(--chat-bg-elevated) 50%);
}

body.dark-mode .ranking-page__podium-card--silver {
  background: linear-gradient(180deg, rgba(142, 154, 175, 0.1) 0%, var(--chat-bg-elevated) 50%);
}

body.dark-mode .ranking-page__podium-card--bronze {
  background: linear-gradient(180deg, rgba(199, 123, 74, 0.1) 0%, var(--chat-bg-elevated) 50%);
}

@media (prefers-reduced-motion: reduce) {
  .ranking-page__switch-thumb,
  .ranking-page__podium-card,
  .ranking-page__row,
  .ranking-page__cta,
  .ranking-page__podium-skeleton-card,
  .ranking-page__row-skeleton {
    transition: none;
    animation: none;
  }
}
</style>
