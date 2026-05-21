<script setup lang="ts">
import type { Partitions } from '@/store/postStore'
import { Icon } from '@iconify/vue'
import {
  onMounted,
  ref,
  watch,
} from 'vue'

import { useRoute } from 'vue-router'
import { showMsg } from '@/components/MessageBox'
import PostList from '@/components/PostList.vue'
import { searchRagPosts } from '@/api/ragSearch'
import { usePostView } from '@/composables/usePostView'
import { usePostStore } from '@/store/postStore'
import { useUserStore } from '@/store/userStore'
import type { Post } from '@/types/post'

const { search, setSearchTimeRange, refreshPosts, conditions, updateNum } = usePostStore()
const { userInfo } = useUserStore()
const route = useRoute()
const { posts, update, isLoading, hasMore, initialize } = usePostView()

const isDense = ref(false)
const keyword = ref('')
const timeFrom = ref('')
const timeTo = ref('')
const filtering = ref(false)
const isSmartMode = ref(false)
const smartLoading = ref(false)
const smartError = ref('')
const initialized = ref(false)

async function runSearch() {
  isSmartMode.value = false
  smartError.value = ''
  filtering.value = true
  hasMore.value = true
  refreshPosts()
  search(keyword.value, route.query?.partition as typeof Partitions[number] | undefined)
  setSearchTimeRange(timeFrom.value, timeTo.value)
  await update()
  await updateNum(userInfo.phone)
  filtering.value = false
}

async function runSmartSearch() {
  if (!keyword.value)
    return
  isSmartMode.value = true
  smartLoading.value = true
  smartError.value = ''
  posts.splice(0, posts.length)
  hasMore.value = false
  try {
    const response = await searchRagPosts(keyword.value, 10, 'manual')
    const ragPosts = (response.data?.results || [])
      .map(result => result.post)
      .filter((post): post is Post => !!post)
    posts.splice(0, posts.length, ...ragPosts)
  }
  catch (error) {
    smartError.value = error instanceof Error ? error.message : '智能检索失败'
  }
  finally {
    smartLoading.value = false
  }
}

function clearTimeFilter() {
  timeFrom.value = ''
  timeTo.value = ''
  void runSearch()
}

function loadMore() {
  if (isSmartMode.value)
    return
  void update()
}

async function initializeFromRoute() {
  const query = route.query
  if (!('sinfo' in query))
    return showMsg('未知的搜索')
  const sinfo = query.sinfo as string
  keyword.value = sinfo
  isDense.value = false
  timeFrom.value = ''
  timeTo.value = ''
  smartError.value = ''
  const partition = query?.partition as typeof Partitions[number] | undefined
  if (query.timeFrom && typeof query.timeFrom === 'string')
    timeFrom.value = query.timeFrom
  if (query.timeTo && typeof query.timeTo === 'string')
    timeTo.value = query.timeTo
  if (partition === '课程交流')
    isDense.value = true
  await initialize(partition || '主页', {
    afterRefresh: () => {
      search(sinfo, partition)
      if (timeFrom.value || timeTo.value)
        setSearchTimeRange(timeFrom.value, timeTo.value)
    },
  })
  if (query.smart === '1')
    await runSmartSearch()
}

onMounted(async () => {
  await initializeFromRoute()
  initialized.value = true
})

watch(
  () => [route.query.sinfo, route.query.partition, route.query.smart, route.query.timeFrom, route.query.timeTo],
  async ([sinfo, partition, smart, timeFrom, timeTo], [previousSinfo, previousPartition, previousSmart, previousTimeFrom, previousTimeTo]) => {
    if (!initialized.value)
      return

    const queryChanged = sinfo !== previousSinfo
      || partition !== previousPartition
      || timeFrom !== previousTimeFrom
      || timeTo !== previousTimeTo

    if (queryChanged) {
      await initializeFromRoute()
      return
    }

    if (!keyword.value || smart === previousSmart)
      return
    if (smart === '1')
      await runSmartSearch()
    else
      await runSearch()
  },
)
</script>

<template>
  <div class="search-page">
    <header class="search-page__head">
      <h2 class="search-page__title">
        搜索
      </h2>
      <p v-if="keyword && !isSmartMode" class="search-page__keyword">
        关键词：<span>{{ keyword }}</span>
      </p>
    </header>

    <section v-if="!isSmartMode" class="search-page__filter" aria-label="发帖时间筛选">
      <p class="search-page__filter-label">
        发帖时间范围
      </p>
      <div class="search-page__filter-row">
        <label class="search-page__field">
          <span class="search-page__field-label">从</span>
          <input
            v-model="timeFrom"
            type="datetime-local"
            class="search-page__input"
          >
        </label>
        <span class="search-page__sep" aria-hidden="true">—</span>
        <label class="search-page__field">
          <span class="search-page__field-label">到</span>
          <input
            v-model="timeTo"
            type="datetime-local"
            class="search-page__input"
          >
        </label>
      </div>
      <div class="search-page__filter-actions">
        <button
          type="button"
          class="search-page__btn search-page__btn--primary"
          :disabled="filtering"
          @click="runSearch"
        >
          <Icon icon="tabler:filter" width="16" height="16" aria-hidden="true" />
          应用筛选
        </button>
        <button
          v-if="conditions.timeFrom || conditions.timeTo"
          type="button"
          class="search-page__btn"
          :disabled="filtering"
          @click="clearTimeFilter"
        >
          清除时间
        </button>
      </div>
      <p
        v-if="conditions.timeFrom || conditions.timeTo"
        class="search-page__active-hint"
      >
        已筛选：
        <template v-if="conditions.timeFrom">{{ conditions.timeFrom.replace('T', ' ') }}</template>
        <template v-else>不限</template>
        至
        <template v-if="conditions.timeTo">{{ conditions.timeTo.replace('T', ' ') }}</template>
        <template v-else>不限</template>
      </p>
    </section>

    <p v-if="smartLoading" class="search-page__status">
      智能检索中...
    </p>
    <p v-if="smartError" class="search-page__error">
      {{ smartError }}
    </p>

    <PostList
      :posts="posts"
      :is-dense="isDense"
      :is-loading="isLoading || filtering || smartLoading"
      :has-more="hasMore"
      @bottom="loadMore"
    />
  </div>
</template>

<style scoped lang="scss">
.search-page {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 12px 1rem;
  box-sizing: border-box;
  color: var(--chat-text);
}

.search-page__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  margin-bottom: 10px;
}

.search-page__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--chat-text);
}

.search-page__keyword {
  flex-basis: 100%;
  margin: 0;
  font-size: 0.875rem;
  color: var(--chat-text-secondary);

  span {
    color: var(--chat-accent);
    font-weight: 600;
  }
}

.search-page__filter {
  margin-bottom: 12px;
  padding: 12px;
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 12px;
}

.search-page__filter-label {
  margin: 0 0 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--chat-text-secondary);
}

.search-page__filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px;
}

.search-page__field {
  flex: 1 1 140px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.search-page__field-label {
  font-size: 0.75rem;
  color: var(--chat-text-tips);
}

.search-page__input {
  width: 100%;
  min-height: 36px;
  padding: 6px 10px;
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  background: var(--chat-bg);
  color: var(--chat-text);
  font-size: 0.8125rem;
  font-family: inherit;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: var(--chat-accent);
  }
}

.search-page__sep {
  flex-shrink: 0;
  padding-bottom: 8px;
  color: var(--chat-text-tips);
}

.search-page__filter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.search-page__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid var(--chat-border);
  background: var(--chat-bg);
  color: var(--chat-text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;

  &--primary {
    border-color: var(--chat-accent);
    background: var(--chat-accent);
    color: #fff;
    font-weight: 600;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.search-page__active-hint {
  margin: 8px 0 0;
  font-size: 0.75rem;
  color: var(--chat-text-tips);
  line-height: 1.45;
}

.search-page__status {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid var(--chat-border);
  border-radius: 10px;
  background: var(--chat-bg-highlight);
  color: var(--chat-text-secondary);
  font-size: 0.8125rem;
}

.search-page__error {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid rgba(244, 67, 54, 0.35);
  border-radius: 10px;
  background: rgba(244, 67, 54, 0.08);
  color: var(--color-error);
  font-size: 0.8125rem;
}

@media screen and (min-width: 768px) {
  .search-page {
    margin: 0 5%;
  }
}
</style>
