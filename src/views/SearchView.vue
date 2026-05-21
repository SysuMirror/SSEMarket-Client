<script setup lang="ts">
import type { Partitions } from '@/store/postStore'
import { Icon } from '@iconify/vue'
import {
  onMounted,
  ref,
} from 'vue'

import { useRoute, useRouter } from 'vue-router'
import { showMsg } from '@/components/MessageBox'
import PostList from '@/components/PostList.vue'
import { usePostView } from '@/composables/usePostView'
import { usePostStore } from '@/store/postStore'
import { useUserStore } from '@/store/userStore'

const { search, setSearchTimeRange, refreshPosts, conditions, updateNum } = usePostStore()
const { userInfo } = useUserStore()
const route = useRoute()
const router = useRouter()
const { posts, update, isLoading, hasMore, initialize } = usePostView()

const isDense = ref(false)
const keyword = ref('')
const timeFrom = ref('')
const timeTo = ref('')
const filtering = ref(false)

async function runSearch() {
  filtering.value = true
  hasMore.value = true
  refreshPosts()
  setSearchTimeRange(timeFrom.value, timeTo.value)
  await update()
  await updateNum(userInfo.phone)
  filtering.value = false
}

function clearTimeFilter() {
  timeFrom.value = ''
  timeTo.value = ''
  void runSearch()
}

function switchToSmartSearch() {
  if (!keyword.value)
    return
  router.push({
    name: 'RagPreview',
    query: { q: keyword.value, limit: '10' },
  })
}

onMounted(async () => {
  const query = route.query
  if (!('sinfo' in query))
    return showMsg('未知的搜索')
  const sinfo = query.sinfo as string
  keyword.value = sinfo
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
})
</script>

<template>
  <div class="search-page">
    <header class="search-page__head">
      <h2 class="search-page__title">
        搜索
      </h2>
      <div class="search-page__mode-switch" aria-label="搜索模式">
        <span class="search-page__mode search-page__mode--active">普通搜索</span>
        <button class="search-page__mode" type="button" @click="switchToSmartSearch">
          智能搜索
        </button>
      </div>
      <p v-if="keyword" class="search-page__keyword">
        关键词：<span>{{ keyword }}</span>
      </p>
    </header>

    <section class="search-page__filter" aria-label="发帖时间筛选">
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

    <PostList
      :posts="posts"
      :is-dense="isDense"
      :is-loading="isLoading || filtering"
      :has-more="hasMore"
      @bottom="update"
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
  margin-bottom: 10px;
}

.search-page__mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding: 3px;
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  background: var(--chat-bg-highlight);
}

.search-page__mode {
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--chat-text-secondary);
  padding: 5px 10px;
  font-size: 0.8125rem;
  font-family: inherit;
  cursor: pointer;
}

.search-page__mode--active {
  background: var(--chat-accent);
  color: #fff;
  cursor: default;
}

.search-page__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--chat-text);
}

.search-page__keyword {
  margin: 6px 0 0;
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

@media screen and (min-width: 768px) {
  .search-page {
    margin: 0 5%;
  }
}
</style>
