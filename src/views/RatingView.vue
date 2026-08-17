<script setup lang="ts">
import type { RatingCategory, RatingPostItem } from '@/api/rating/types'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getRatingCategories, getRatingPosts } from '@/api/rating'
import RatingCard from '@/components/rating/RatingCard.vue'
import { ratingZonePath } from '@/utils/ratingRoute'

defineOptions({ name: 'RatingView' })

const route = useRoute()
const router = useRouter()
const categories = ref<RatingCategory[]>([])
const activeCategoryID = ref(0)
const posts = ref<RatingPostItem[]>([])
const searchKeyword = ref('')
const isLoading = ref(false)
const hasMore = ref(true)
const offset = ref(0)
const limit = 20

const activeCategoryName = computed(() => {
  if (activeCategoryID.value === 0)
    return ''
  return categories.value.find(c => c.categoryID === activeCategoryID.value)?.name ?? ''
})

function parseCategoryFromRoute(): number {
  const n = Number(route.query.category)
  return Number.isFinite(n) && n > 0 ? n : 0
}

async function loadCategories() {
  categories.value = await getRatingCategories()
}

async function loadPosts(reset = false) {
  if (reset) {
    offset.value = 0
    posts.value = []
    hasMore.value = true
  }
  if (!hasMore.value && !reset)
    return
  isLoading.value = true
  const batch = await getRatingPosts({
    categoryID: activeCategoryID.value || undefined,
    searchinfo: searchKeyword.value.trim(),
    limit,
    offset: offset.value,
  })
  if (reset)
    posts.value = batch
  else
    posts.value.push(...batch)
  offset.value += batch.length
  hasMore.value = batch.length === limit
  isLoading.value = false
}

function syncRouteCategory() {
  const id = activeCategoryID.value
  const cur = parseCategoryFromRoute()
  if (cur === id)
    return
  router.replace(id > 0 ? ratingZonePath(id) : { path: '/rating' })
}

function selectCategory(id: number) {
  if (activeCategoryID.value === id)
    return
  activeCategoryID.value = id
  syncRouteCategory()
  loadPosts(true)
}

function goCreatePost() {
  const q = activeCategoryID.value > 0 ? { category: String(activeCategoryID.value) } : {}
  router.push({ path: '/rating/post', query: q })
}

function goCreateCategory() {
  router.push('/rating/category/new')
}

async function onSearch() {
  await loadPosts(true)
}

function onLikeChange(p: RatingPostItem) {
  p.isLiked = !p.isLiked
  p.like += p.isLiked ? 1 : -1
}

onMounted(async () => {
  activeCategoryID.value = parseCategoryFromRoute()
  await loadCategories()
  await loadPosts(true)
})

watch(() => route.query.category, async () => {
  const id = parseCategoryFromRoute()
  if (id !== activeCategoryID.value) {
    activeCategoryID.value = id
    await loadPosts(true)
  }
})
</script>

<template>
  <div class="rating-zone rating-page">
    <header class="rating-page__top">
      <div class="rating-page__brand">
        <Icon icon="tabler:flame" width="20" height="20" aria-hidden="true" />
        <span class="rating-page__brand-title">打分专区</span>
      </div>
      <div class="rating-page__actions">
        <button
          type="button"
          class="rating-page__btn rating-page__btn--ghost"
          aria-label="创建分区"
          @click="goCreateCategory"
        >
          <Icon icon="tabler:folder-plus" width="15" height="15" aria-hidden="true" />
          <span class="rating-page__btn-text">创建分区</span>
        </button>
        <button
          type="button"
          class="rating-page__btn rating-page__btn--primary"
          aria-label="发布评分"
          @click="goCreatePost"
        >
          <Icon icon="tabler:plus" width="15" height="15" aria-hidden="true" />
          <span class="rating-page__btn-text">发布</span>
        </button>
      </div>
    </header>

    <div class="rating-page__search">
      <Icon icon="tabler:search" width="16" height="16" class="rating-page__search-ico" aria-hidden="true" />
      <input
        v-model="searchKeyword"
        type="search"
        placeholder="搜索主题或分区名（如「其他」）"
        @keyup.enter="onSearch"
      >
      <button type="button" class="rating-page__search-go" @click="onSearch">
        搜
      </button>
    </div>

    <nav class="rating-page__cats" aria-label="分区筛选">
      <button
        type="button"
        class="rating-cat-pill"
        :class="{ 'rating-cat-pill--active': activeCategoryID === 0 }"
        @click="selectCategory(0)"
      >
        全部
      </button>
      <button
        v-for="c in categories"
        :key="c.categoryID"
        type="button"
        class="rating-cat-pill"
        :class="{ 'rating-cat-pill--active': activeCategoryID === c.categoryID }"
        @click="selectCategory(c.categoryID)"
      >
        {{ c.name }}
        <span class="rating-cat-pill__n">{{ c.postCount }}</span>
      </button>
    </nav>

    <p v-if="activeCategoryName" class="rating-page__ctx">
      当前分区：<strong>{{ activeCategoryName }}</strong>
    </p>

    <div class="rating-feed">
      <RatingCard
        v-for="p in posts"
        :key="p.ratingPostID"
        :post="p"
        @like-change="onLikeChange(p)"
      />
      <p v-if="!isLoading && posts.length === 0" class="rating-feed__empty">
        暂无内容
      </p>
      <button
        v-if="hasMore && posts.length > 0"
        type="button"
        class="rating-feed__more"
        :disabled="isLoading"
        @click="loadPosts(false)"
      >
        {{ isLoading ? '…' : '加载更多' }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.rating-page {
  width: 100%;
  max-width: 720px;
  min-width: 0;
  margin: 0 auto;
  padding: 8px 10px 20px;
  box-sizing: border-box;
  overflow-x: hidden;
}

.rating-page__top {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 8px;
  min-width: 0;
}

.rating-page__brand {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  color: var(--chat-accent);
  font-weight: 800;
  font-size: 14px;
}

.rating-page__brand-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rating-page__actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
}

.rating-page__btn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid var(--hp-border, #e8eaed);
  background: var(--hp-card, #fff);

  &--primary {
    border-color: var(--chat-accent);
    background: var(--chat-accent);
    color: var(--chat-unread-text);
  }

  &--ghost {
    color: var(--chat-accent);
    background: var(--chat-accent-soft, #fff5eb);
    border-color: transparent;
  }
}

@media screen and (max-width: 340px) {
  .rating-page__btn-text {
    display: none;
  }

  .rating-page__btn {
    padding: 6px 7px;
  }
}

.rating-page__search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 2px 2px 2px 10px;
  border: 1px solid var(--hp-border, #e8eaed);
  border-radius: 8px;
  background: var(--hp-card, #fff);

  input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    font-size: 13px;
    padding: 7px 0;

    &:focus {
      outline: none;
    }
  }
}

.rating-page__search-ico {
  color: var(--hp-muted, #8a9199);
  flex-shrink: 0;
}

.rating-page__search-go {
  flex-shrink: 0;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: var(--chat-accent);
  color: var(--chat-unread-text);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.rating-page__cats {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
  margin-bottom: 6px;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--hp-border, #d0d5dd) transparent;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--hp-border, #d0d5dd);
    border-radius: 4px;
  }
}

.rating-cat-pill {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 11px;
  border: 1px solid var(--hp-border, #e8eaed);
  border-radius: 999px;
  background: var(--hp-card, #fff);
  font-size: 12px;
  font-weight: 600;
  color: var(--hp-text, #1a1a1a);
  cursor: pointer;
  white-space: nowrap;

  &--active {
    border-color: var(--chat-accent);
    background: var(--chat-accent-soft, #fff5eb);
    color: var(--chat-accent);
  }
}

.rating-cat-pill__n {
  font-size: 10px;
  font-weight: 700;
  opacity: 0.75;
}

.rating-page__ctx {
  margin: 0 0 6px;
  font-size: 11px;
  color: var(--hp-muted, #8a9199);

  strong {
    color: var(--chat-accent);
    font-weight: 700;
  }
}

.rating-feed {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rating-feed__empty {
  text-align: center;
  padding: 24px;
  font-size: 13px;
  color: var(--hp-muted, #8a9199);
}

.rating-feed__more {
  padding: 8px;
  border: 1px solid var(--hp-border, #e8eaed);
  border-radius: 8px;
  background: var(--hp-card, #fff);
  font-size: 12px;
  color: var(--chat-accent);
  cursor: pointer;
}
</style>
