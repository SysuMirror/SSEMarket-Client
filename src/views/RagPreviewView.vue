<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BasicCard from '@/components/card/BasicCard.vue'
import PostList from '@/components/PostList.vue'
import { fetchHotQueries, searchRagPosts, type HotQuery, type RagSearchData } from '@/api/ragSearch'
import type { Post } from '@/types/post'
import { getWindowScrollY, setWindowScrollY } from '@/utils/windowScroll'

const CACHE_PREFIX = 'ssemarket:rag-preview:'
const LAST_CACHE_KEY = `${CACHE_PREFIX}last`
const CACHE_TTL_MS = 15 * 60 * 1000

const route = useRoute()
const router = useRouter()

const query = ref('')
const limit = ref(10)
const loading = ref(false)
const error = ref('')
const searchData = ref<RagSearchData | null>(null)
const hotQueries = ref<HotQuery[]>([])
const rollingHotIndex = ref(0)
let hotQueryTimer: ReturnType<typeof window.setInterval> | null = null
let activeCacheKey = ''

interface RagPreviewCache {
  query: string
  limit: number
  searchData: RagSearchData
  scrollTop: number
  savedAt: number
}

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function getCacheKey(value: string, count: number) {
  return `${CACHE_PREFIX}${count}:${normalizeQuery(value)}`
}

function replaceSearchUrl(value: string, count: number) {
  const params = new URLSearchParams()
  params.set('q', value)
  params.set('limit', String(count))
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`)
}

function readCache(key: string): RagPreviewCache | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw)
      return null
    const cached = JSON.parse(raw) as RagPreviewCache
    if (!cached.searchData || Date.now() - cached.savedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(key)
      return null
    }
    return cached
  }
  catch {
    return null
  }
}

function writeCache(key = activeCacheKey) {
  if (!key || !searchData.value)
    return
  const payload: RagPreviewCache = {
    query: query.value,
    limit: limit.value,
    searchData: searchData.value,
    scrollTop: getWindowScrollY(),
    savedAt: Date.now(),
  }
  try {
    sessionStorage.setItem(key, JSON.stringify(payload))
    sessionStorage.setItem(LAST_CACHE_KEY, key)
  }
  catch {
    // 缓存失败不影响搜索本身。
  }
}

async function restoreFromCache(cached: RagPreviewCache) {
  query.value = cached.query
  limit.value = cached.limit
  searchData.value = cached.searchData
  error.value = ''
  await nextTick()
  requestAnimationFrame(() => {
    setWindowScrollY(cached.scrollTop)
    requestAnimationFrame(() => setWindowScrollY(cached.scrollTop))
  })
}

const candidateText = computed(() => {
  if (!searchData.value)
    return '等待检索'
  return `MySQL ${searchData.value.mysql_hits} / Qdrant ${searchData.value.qdrant_hits}`
})

const ragPosts = computed<Post[]>(() => {
  return (searchData.value?.results || [])
    .map(result => result.post)
    .filter((post): post is Post => !!post)
})

const rewriteSuggestions = computed(() => searchData.value?.suggestions || [])
const activeHotQuery = computed(() => hotQueries.value[rollingHotIndex.value]?.query || '')
const showRollingHotQuery = computed(() => !query.value.trim() && !!activeHotQuery.value)
const normalSearchQuery = computed(() => query.value.trim() ? { sinfo: query.value.trim() } : {})

async function loadHotQueries() {
  try {
    hotQueries.value = await fetchHotQueries(8)
    rollingHotIndex.value = 0
  }
  catch {
    hotQueries.value = []
  }
}

function startHotQueryRolling() {
  if (hotQueryTimer)
    window.clearInterval(hotQueryTimer)
  hotQueryTimer = window.setInterval(() => {
    if (hotQueries.value.length <= 1)
      return
    rollingHotIndex.value = (rollingHotIndex.value + 1) % hotQueries.value.length
  }, 2200)
}

async function runSearch(nextQuery = query.value, options: { syncRoute?: boolean } = {}) {
  const cleanQuery = nextQuery.trim() || activeHotQuery.value
  if (!cleanQuery) {
    error.value = '请输入搜索内容'
    return
  }
  query.value = cleanQuery
  activeCacheKey = getCacheKey(cleanQuery, limit.value)
  if (options.syncRoute) {
    replaceSearchUrl(cleanQuery, limit.value)
  }
  loading.value = true
  error.value = ''
  try {
    const res = await searchRagPosts(cleanQuery, limit.value)
    searchData.value = res.data || null
    writeCache()
    void loadHotQueries()
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : '复合检索请求失败'
    searchData.value = null
  }
  finally {
    loading.value = false
  }
}

function switchToNormalSearch() {
  if (!query.value.trim())
    return
  router.push({
    name: 'Search',
    query: normalSearchQuery.value,
  })
}

onMounted(() => {
  void loadHotQueries()
  startHotQueryRolling()

  const routeQuery = typeof route.query.q === 'string' ? route.query.q : ''
  const routeLimit = Number(route.query.limit)
  if ([3, 5, 10].includes(routeLimit))
    limit.value = routeLimit
  if (routeQuery) {
    query.value = routeQuery
    activeCacheKey = getCacheKey(routeQuery, limit.value)
    const cached = readCache(activeCacheKey)
    if (cached) {
      void restoreFromCache(cached)
      return
    }
    void runSearch(routeQuery)
    return
  }

  query.value = ''
  searchData.value = null
  error.value = ''
  activeCacheKey = ''
  sessionStorage.removeItem(LAST_CACHE_KEY)
})

onUnmounted(() => {
  writeCache()
  if (hotQueryTimer)
    window.clearInterval(hotQueryTimer)
})

</script>

<template>
  <div class="rag-preview-page">
    <section class="rag-preview-hero">
      <div class="rag-preview-hero__copy">
        <p class="rag-preview-hero__eyebrow">
          SSE MARKET 复合检索
        </p>
        <h2 class="rag-preview-hero__title">
          智能搜索
        </h2>
      </div>
      <div class="rag-preview-mode" aria-label="搜索模式">
        <button class="rag-preview-mode__item" type="button" :disabled="!query.trim()" @click="switchToNormalSearch">
          普通搜索
        </button>
        <span class="rag-preview-mode__item rag-preview-mode__item--active">智能搜索</span>
      </div>
    </section>

    <BasicCard class="rag-search-card">
      <form class="rag-search-form" @submit.prevent="runSearch(query, { syncRoute: true })">
        <label class="rag-search-form__label" for="rag-query">搜索内容</label>
        <div class="rag-search-form__row">
          <div class="rag-search-form__input-wrap">
            <span v-if="showRollingHotQuery" :key="activeHotQuery" class="rag-search-form__hot-placeholder">
              {{ activeHotQuery }}
            </span>
            <input
              id="rag-query"
              v-model="query"
              class="rag-search-form__input"
              type="search"
              autocomplete="off"
              placeholder=""
            >
          </div>
          <select v-model.number="limit" class="rag-search-form__select" aria-label="结果数量">
            <option :value="3">Top 3</option>
            <option :value="5">Top 5</option>
            <option :value="10">Top 10</option>
          </select>
          <button class="rag-search-form__button" type="submit" :disabled="loading">
            <Icon icon="tabler:search" width="18" height="18" aria-hidden="true" />
            {{ loading ? '检索中' : '搜索' }}
          </button>
        </div>
      </form>
    </BasicCard>

    <section class="rag-summary" aria-live="polite">
      <BasicCard class="rag-summary__item">
        <span>关键词</span>
        <strong>{{ searchData?.keywords?.length ? searchData.keywords.join(' / ') : '暂无' }}</strong>
      </BasicCard>
      <BasicCard class="rag-summary__item">
        <span>候选来源</span>
        <strong>{{ candidateText }}</strong>
      </BasicCard>
      <BasicCard class="rag-summary__item">
        <span>分析来源</span>
        <strong>{{ searchData?.analysis_source || '-' }}</strong>
      </BasicCard>
    </section>

    <p v-if="error" class="rag-error">
      {{ error }}
    </p>

    <section class="rag-results">
      <div class="rag-results__head">
        <h3>结果</h3>
        <span>{{ searchData?.results?.length || 0 }} 条</span>
      </div>

      <PostList
        v-if="ragPosts.length > 0"
        :posts="ragPosts"
        :is-loading="loading"
        :has-more="false"
        :new-post-ids="[]"
      >
      </PostList>

      <BasicCard v-if="!loading && !error && searchData && searchData.results.length === 0 && rewriteSuggestions.length > 0" class="rag-empty rag-empty--suggestions">
        <p class="rag-empty__text">
          试试这些更具体的搜法：
        </p>
        <div class="rag-empty__suggestions">
          <button
            v-for="item in rewriteSuggestions"
            :key="item"
            class="rag-empty__suggestion"
            type="button"
            @click="runSearch(item, { syncRoute: true })"
          >
            {{ item }}
          </button>
        </div>
      </BasicCard>

      <BasicCard v-if="!loading && !error && searchData && searchData.results.length === 0" class="rag-empty">
        没有找到结果，可以换一个更具体的问题。
      </BasicCard>
    </section>
  </div>
</template>

<style scoped lang="scss">
.rag-preview-page {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 0 12px 20px;
  box-sizing: border-box;
  color: var(--chat-text);
}

.rag-preview-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.rag-preview-hero__eyebrow {
  margin: 0 0 4px;
  color: var(--chat-text-secondary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.rag-preview-hero__title {
  margin: 0;
  color: var(--chat-text);
  font-size: 24px;
  font-weight: 700;
}

.rag-preview-mode {
  display: inline-flex;
  flex-shrink: 0;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  background: var(--chat-bg-highlight);
}

.rag-preview-mode__item {
  min-height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--chat-text-secondary);
  font: inherit;
  font-size: 13px;
  line-height: 28px;
  white-space: nowrap;
  cursor: pointer;
}

.rag-preview-mode__item--active {
  background: var(--chat-bg);
  color: var(--chat-text);
  font-weight: 700;
  cursor: default;
}

.rag-preview-mode__item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.rag-search-card {
  margin-bottom: 12px;
}

.rag-search-form__label {
  display: block;
  margin-bottom: 8px;
  color: var(--chat-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.rag-search-form__row {
  display: flex;
  gap: 8px;
}

.rag-search-form__select {
  min-height: 38px;
  border: 1px solid var(--chat-border);
  border-radius: 10px;
  background: var(--chat-bg-main);
  color: var(--chat-text);
  font-family: inherit;
}

.rag-search-form__input-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}

.rag-search-form__input {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 38px;
  border: 1px solid var(--chat-border);
  border-radius: 10px;
  background: transparent;
  color: var(--chat-text);
  font-family: inherit;
  padding: 0 12px;
}

.rag-search-form__hot-placeholder {
  position: absolute;
  top: 50%;
  left: 13px;
  z-index: 0;
  max-width: calc(100% - 26px);
  transform: translateY(-50%);
  color: var(--chat-text-tips);
  font-size: 14px;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: rag-hot-roll 2200ms ease-in-out both;
}

@keyframes rag-hot-roll {
  0% {
    opacity: 0;
    transform: translateY(8px);
  }

  14%,
  82% {
    opacity: 0.58;
    transform: translateY(-50%);
  }

  100% {
    opacity: 0;
    transform: translateY(-18px);
  }
}

.rag-search-form__select {
  width: 86px;
  padding: 0 8px;
}

.rag-search-form__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid var(--chat-accent);
  border-radius: 10px;
  background: var(--chat-accent);
  color: var(--chat-unread-text);
  font-family: inherit;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    cursor: wait;
    opacity: 0.65;
  }
}

.rag-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: stretch;
  margin-bottom: 12px;
}

.rag-summary__item {
  min-width: 0;
  min-height: 66px;
  justify-content: center;
  gap: 6px;
  padding: 12px 14px;

  span {
    display: block;
    color: var(--chat-text-tips);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.2;
  }

  strong {
    display: block;
    color: var(--chat-text);
    font-size: 14px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }
}

.rag-error {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid rgba(244, 67, 54, 0.35);
  border-radius: 10px;
  background: rgba(244, 67, 54, 0.08);
  color: var(--color-error);
  font-size: 13px;
}

.rag-results__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 0 10px;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
  }

  span {
    color: var(--chat-text-secondary);
    font-size: 13px;
  }
}

.rag-empty {
  color: var(--chat-text-secondary);
}

.rag-empty__text {
  margin: 0 0 10px;
}

.rag-empty__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rag-empty__suggestion {
  min-height: 32px;
  border: 1px solid var(--chat-border);
  border-radius: 9px;
  background: var(--chat-bg-main);
  color: var(--chat-text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 0 10px;
  cursor: pointer;

  &:hover {
    border-color: var(--chat-accent);
    color: var(--chat-accent);
  }
}

@media screen and (max-width: 768px) {
  .rag-preview-page {
    padding-bottom: calc(70px + env(safe-area-inset-bottom, 0px));
  }

  .rag-search-form__row {
    flex-direction: column;
    align-items: stretch;
  }

  .rag-search-form__select {
    width: 100%;
  }

  .rag-summary {
    grid-template-columns: 1fr;
  }
}
</style>
