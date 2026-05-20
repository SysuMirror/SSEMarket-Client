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

const subtitle = computed(() => {
  if (activeTab.value === 'post')
    return '按得票数排序，展示前 100 名'
  return '按获赞与获票合计排序，展示前 100 名'
})

const currentList = computed(() => {
  return activeTab.value === 'post' ? postRanking.value : userRanking.value
})

const isEmpty = computed(() => !loading.value && currentList.value.length === 0)

function isTopThree(index: number) {
  return index < 3
}

function userIdAvatarText(userID: number) {
  const s = String(userID)
  if (s.length >= 2)
    return s.slice(0, 2)
  return s.padStart(2, '0')
}

async function loadRanking() {
  loading.value = true
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
    <header class="ranking-page__head">
      <h1 class="ranking-page__title">
        排行榜
      </h1>
      <p class="ranking-page__subtitle">
        {{ subtitle }}
      </p>
    </header>

    <div class="ranking-page__tabs" role="tablist" aria-label="榜单类型">
      <button
        type="button"
        class="ranking-page__tab"
        :class="{ 'ranking-page__tab--active': activeTab === 'post' }"
        role="tab"
        :aria-selected="activeTab === 'post'"
        @click="activeTab = 'post'"
      >
        优质榜
      </button>
      <button
        type="button"
        class="ranking-page__tab"
        :class="{ 'ranking-page__tab--active': activeTab === 'user' }"
        role="tab"
        :aria-selected="activeTab === 'user'"
        @click="activeTab = 'user'"
      >
        用户榜
      </button>
    </div>

    <section class="ranking-page__section" :aria-busy="loading">
      <p class="ranking-page__section-label">
        {{ activeTab === 'post' ? '帖子' : '用户' }}
      </p>

      <div v-if="loading" class="ranking-page__group">
        <div
          v-for="i in 8"
          :key="i"
          class="ranking-page__skeleton-row"
          :class="{ 'ranking-page__skeleton-row--last': i === 8 }"
        >
          <span class="ranking-page__skeleton-rank" />
          <span class="ranking-page__skeleton-main">
            <span class="ranking-page__skeleton-line ranking-page__skeleton-line--title" />
            <span class="ranking-page__skeleton-line" />
          </span>
        </div>
      </div>

      <div v-else-if="isEmpty" class="ranking-page__empty">
        <p class="ranking-page__empty-title">
          暂无数据
        </p>
        <p class="ranking-page__empty-hint">
          投票或互动后，榜单会在这里更新
        </p>
      </div>

      <ol v-else-if="activeTab === 'post'" class="ranking-page__group ranking-page__list">
        <li
          v-for="(item, index) in postRanking"
          :key="item.postID"
          class="ranking-page__list-item"
        >
          <RouterLink
            :to="`/postdetail/${item.postID}`"
            class="ranking-page__row"
            :class="{ 'ranking-page__row--top': isTopThree(index) }"
          >
            <span
              class="ranking-page__rank"
              :class="{ 'ranking-page__rank--top': isTopThree(index) }"
            >{{ index + 1 }}</span>
            <span class="ranking-page__main">
              <span class="ranking-page__name">{{ item.title }}</span>
              <span class="ranking-page__meta">
                <span v-if="item.partition" class="ranking-page__meta-item">{{ item.partition }}</span>
                <span class="ranking-page__meta-item">{{ item.voteCount }} 票</span>
              </span>
            </span>
            <Icon
              icon="tabler:chevron-right"
              class="ranking-page__disclosure"
              width="18"
              height="18"
              aria-hidden="true"
            />
          </RouterLink>
        </li>
      </ol>

      <ol v-else class="ranking-page__group ranking-page__list">
        <li
          v-for="(item, index) in userRanking"
          :key="item.userID"
          class="ranking-page__list-item"
        >
          <RouterLink
            :to="`/user/${item.userID}`"
            class="ranking-page__row"
            :class="{ 'ranking-page__row--top': isTopThree(index) }"
          >
            <span
              class="ranking-page__rank"
              :class="{ 'ranking-page__rank--top': isTopThree(index) }"
            >{{ index + 1 }}</span>
            <span class="ranking-page__avatar" aria-hidden="true">
              {{ userIdAvatarText(item.userID) }}
            </span>
            <span class="ranking-page__main">
              <span class="ranking-page__name">{{ item.userName || `用户 ${item.userID}` }}</span>
              <span class="ranking-page__meta">
                <span class="ranking-page__meta-item">赞 {{ item.receivedLikeNum }}</span>
                <span class="ranking-page__meta-item">票 {{ item.receivedVoteNum }}</span>
                <span class="ranking-page__meta-item ranking-page__meta-item--emphasis">合计 {{ item.rankScore }}</span>
              </span>
            </span>
            <Icon
              icon="tabler:chevron-right"
              class="ranking-page__disclosure"
              width="18"
              height="18"
              aria-hidden="true"
            />
          </RouterLink>
        </li>
      </ol>
    </section>

    <footer class="ranking-page__footer">
      <RouterLink to="/vote" class="ranking-page__action">
        去投票
      </RouterLink>
    </footer>
  </div>
</template>

<style scoped lang="scss">
/* 分组列表 + 克制排版：对齐站内个人主页 / 设置页，避免渐变光晕与悬浮卡片 */
.ranking-page {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 14px 1.75rem;
  box-sizing: border-box;
  color: var(--chat-text);
}

.ranking-page__head {
  padding: 4px 2px 16px;
}

.ranking-page__title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--chat-text);
}

.ranking-page__subtitle {
  margin: 6px 0 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--chat-text-secondary);
}

/* 分段：扁平下划线，接近 iOS / HarmonyOS 设置页 Tab */
.ranking-page__tabs {
  display: flex;
  gap: 0;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--chat-border);
}

.ranking-page__tab {
  flex: 1;
  margin: 0;
  padding: 10px 12px 12px;
  font-size: 0.9375rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--chat-text-secondary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
  -webkit-tap-highlight-color: transparent;

  &--active {
    color: var(--chat-text);
    font-weight: 600;
    border-bottom-color: var(--chat-accent);
  }
}

.ranking-page__section-label {
  margin: 0 4px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--chat-text-tips);
}

/* 分组容器：Apple inset grouped / Fluent 单卡片 */
.ranking-page__group {
  margin: 0;
  padding: 0;
  list-style: none;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.ranking-page__list-item {
  margin: 0;
  padding: 0;

  &:not(:last-child) .ranking-page__row {
    border-bottom: 1px solid var(--chat-border);
  }
}

.ranking-page__row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 12px 14px;
  text-decoration: none;
  color: inherit;
  background: var(--chat-bg-highlight);
  transition: background 0.12s ease;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    background: var(--chat-bg-main);
  }

  &:active {
    background: var(--chat-accent-soft);
  }

  &--top {
    background: var(--chat-bg-elevated);
  }
}

.ranking-page__rank {
  flex-shrink: 0;
  width: 1.75rem;
  font-size: 0.9375rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  text-align: center;
  color: var(--chat-text-tips);

  &--top {
    font-weight: 700;
    color: var(--chat-accent);
  }
}

.ranking-page__avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--chat-text-secondary);
  background: var(--chat-bg-main);
  border: 1px solid var(--chat-border);
  border-radius: 50%;
}

.ranking-page__main {
  min-width: 0;
  flex: 1;
}

.ranking-page__name {
  display: block;
  font-size: 0.9375rem;
  font-weight: 500;
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
  gap: 4px 10px;
  margin-top: 2px;
}

.ranking-page__meta-item {
  font-size: 0.8125rem;
  line-height: 1.3;
  color: var(--chat-text-secondary);

  &--emphasis {
    color: var(--chat-text);
    font-weight: 500;
  }

  &:not(:last-child)::after {
    content: '·';
    margin-left: 10px;
    color: var(--chat-text-tips);
    font-weight: 400;
  }
}

.ranking-page__disclosure {
  flex-shrink: 0;
  color: var(--chat-text-tips);
  opacity: 0.65;
}

/* 骨架：简单分隔行，无独立圆角卡片 */
.ranking-page__skeleton-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid var(--chat-border);

  &--last {
    border-bottom: none;
  }
}

.ranking-page__skeleton-rank {
  width: 28px;
  height: 14px;
  border-radius: 4px;
  background: var(--chat-bg-main);
}

.ranking-page__skeleton-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ranking-page__skeleton-line {
  height: 10px;
  width: 40%;
  border-radius: 4px;
  background: var(--chat-bg-main);

  &--title {
    height: 12px;
    width: 72%;
  }
}

.ranking-page__empty {
  padding: 2.5rem 1.25rem;
  text-align: center;
  background: var(--chat-bg-highlight);
  border: 1px dashed var(--chat-border);
  border-radius: 16px;
}

.ranking-page__empty-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--chat-text);
}

.ranking-page__empty-hint {
  margin: 8px 0 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--chat-text-secondary);
}

/* 底部操作：与 profile-dm 一致，描边按钮而非渐变 CTA */
.ranking-page__footer {
  margin-top: 20px;
}

.ranking-page__action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 44px;
  padding: 10px 18px;
  font-size: 0.9375rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--chat-accent);
  text-decoration: none;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border-strong);
  border-radius: 14px;
  box-sizing: border-box;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: var(--chat-accent-soft);
    border-color: var(--chat-accent);
  }

  &:active {
    opacity: 0.92;
  }
}

body.dark-mode .ranking-page__group {
  box-shadow: none;
}

body.dark-mode .ranking-page__row--top {
  background: var(--chat-bg-main);
}

@media (prefers-reduced-motion: reduce) {
  .ranking-page__tab,
  .ranking-page__row,
  .ranking-page__action {
    transition: none;
  }
}
</style>
