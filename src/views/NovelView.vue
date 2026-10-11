<script lang="ts" setup>
import type { NovelCategoryItem, NovelItem } from '@/api/novel/types'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getNovelCategories, getNovels, getShelf } from '@/api/novel'
import NovelCard from '@/components/novel/NovelCard.vue'
import { novelWritePath } from '@/utils/novelRoute'

defineOptions({ name: 'NovelView' })

const route = useRoute()
const router = useRouter()

const categories = ref<NovelCategoryItem[]>([])
const novels = ref<NovelItem[]>([])
const activeCategory = ref('')
const activeTab = ref<'discover' | 'shelf'>('discover')
const keyword = ref('')
const isLoading = ref(false)
const hasMore = ref(true)
const offset = ref(0)
const limit = 20

const total = ref(0)

const activeTabLabel = computed(() => (activeTab.value === 'shelf' ? '我的书架' : '发现'))

function parseTab(): 'discover' | 'shelf' {
  return route.query.tab === 'shelf' ? 'shelf' : 'discover'
}

async function loadCategories() {
  categories.value = await getNovelCategories()
}

async function loadNovels(reset = false) {
  if (reset) {
    offset.value = 0
    novels.value = []
    hasMore.value = true
  }
  if (!hasMore.value && !reset)
    return

  isLoading.value = true
  const query = {
    keyword: keyword.value.trim(),
    category: activeCategory.value,
    limit,
    offset: offset.value,
  }
  const result = activeTab.value === 'shelf'
    ? await getShelf({ limit, offset: offset.value })
    : await getNovels(query)

  if (reset)
    novels.value = result.novels
  else
    novels.value.push(...result.novels)

  total.value = result.total
  offset.value += result.novels.length
  hasMore.value = result.novels.length === limit
  isLoading.value = false
}

function selectTab(tab: 'discover' | 'shelf') {
  if (activeTab.value === tab)
    return
  activeTab.value = tab
  router.replace(tab === 'shelf' ? { path: '/novel', query: { tab: 'shelf' } } : { path: '/novel' })
  loadNovels(true)
}

function selectCategory(name: string) {
  if (activeCategory.value === name)
    return
  activeCategory.value = name
  loadNovels(true)
}

function onSearch() {
  loadNovels(true)
}

onMounted(async () => {
  activeTab.value = parseTab()
  await Promise.all([loadCategories(), loadNovels(true)])
})

watch(() => route.query.tab, () => {
  const tab = parseTab()
  if (tab !== activeTab.value) {
    activeTab.value = tab
    loadNovels(true)
  }
})
</script>

<template>
  <div class="novel-zone novel-page">
    <header class="novel-page__top">
      <div class="novel-page__brand">
        <Icon icon="tabler:book-2" width="20" height="20" aria-hidden="true" />
        <span class="novel-page__brand-title">小说</span>
      </div>
      <div class="novel-page__actions">
        <button
          type="button"
          class="novel-page__btn novel-page__btn--ghost"
          :class="{ 'novel-page__btn--on': activeTab === 'shelf' }"
          @click="selectTab('shelf')"
        >
          <Icon icon="tabler:bookmark" width="15" height="15" aria-hidden="true" />
          <span class="novel-page__btn-text">书架</span>
        </button>
        <button
          type="button"
          class="novel-page__btn novel-page__btn--ghost"
          :class="{ 'novel-page__btn--on': activeTab === 'discover' }"
          @click="selectTab('discover')"
        >
          <Icon icon="tabler:compass" width="15" height="15" aria-hidden="true" />
          <span class="novel-page__btn-text">发现</span>
        </button>
        <RouterLink to="/novel/points" class="novel-page__btn novel-page__btn--ghost">
          <Icon icon="tabler:coin" width="15" height="15" aria-hidden="true" />
          <span class="novel-page__btn-text">积分</span>
        </RouterLink>
        <RouterLink :to="novelWritePath()" class="novel-page__btn novel-page__btn--primary">
          <Icon icon="tabler:pencil" width="15" height="15" aria-hidden="true" />
          <span class="novel-page__btn-text">写书</span>
        </RouterLink>
      </div>
    </header>

    <div class="novel-page__search">
      <Icon icon="tabler:search" width="16" height="16" class="novel-page__search-ico" aria-hidden="true" />
      <input
        v-model="keyword"
        type="search"
        :disabled="activeTab === 'shelf'"
        :placeholder="activeTab === 'shelf' ? '书架内不支持搜索' : '搜索书名、作者或简介'"
        @keyup.enter="onSearch"
      >
      <button
        type="button"
        class="novel-page__search-go"
        :disabled="activeTab === 'shelf'"
        @click="onSearch"
      >
        搜
      </button>
    </div>

    <nav v-if="activeTab === 'discover'" class="novel-page__cats" aria-label="分类筛选">
      <button
        type="button"
        class="novel-cat-pill"
        :class="{ 'novel-cat-pill--active': activeCategory === '' }"
        @click="selectCategory('')"
      >
        全部
      </button>
      <button
        v-for="c in categories"
        :key="c.name"
        type="button"
        class="novel-cat-pill"
        :class="{ 'novel-cat-pill--active': activeCategory === c.name }"
        @click="selectCategory(c.name)"
      >
        {{ c.name }}
        <span class="novel-cat-pill__n">{{ c.count }}</span>
      </button>
    </nav>

    <p class="novel-page__ctx">
      {{ activeTabLabel }}
      <strong>{{ total }}</strong> 本
    </p>

    <div class="novel-feed">
      <NovelCard v-for="n in novels" :key="n.novelID" :novel="n" />
      <p v-if="!isLoading && novels.length === 0" class="novel-feed__empty">
        {{ activeTab === 'shelf' ? '书架还是空的，去「发现」里找一本感兴趣的书吧' : '还没有书，点击右上角「写书」开一本' }}
      </p>
      <button
        v-if="hasMore && novels.length > 0"
        type="button"
        class="novel-feed__more"
        :disabled="isLoading"
        @click="loadNovels(false)"
      >
        {{ isLoading ? '…' : '加载更多' }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.novel-page {
  width: 100%;
  max-width: 720px;
  min-width: 0;
  margin: 0 auto;
  padding: 8px 10px 20px;
  box-sizing: border-box;
  overflow-x: hidden;
}

.novel-page__top {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 8px;
  min-width: 0;
}

.novel-page__brand {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  color: var(--accent, #2c3d56);
  font-weight: 800;
  font-size: 14px;
}

.novel-page__brand-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.novel-page__actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
}

.novel-page__btn {
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
  text-decoration: none;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  background: var(--color-card, #fff);
  color: var(--color-text-secondary, #475569);

  &--primary {
    border-color: var(--accent, #2c3d56);
    background: var(--accent, #2c3d56);
    color: #fff;
  }

  &--ghost {
    color: var(--accent, #2c3d56);
    background: var(--accent-soft, rgba(44, 61, 86, 0.08));
    border-color: transparent;
  }

  &--on {
    border: 1px solid var(--accent, #2c3d56);
    background: var(--accent, #2c3d56);
    color: #fff;
  }
}

.novel-page__search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 2px 2px 2px 10px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 8px;
  background: var(--color-card, #fff);

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

    &:disabled {
      color: var(--color-text-muted, #94a3b8);
    }
  }
}

.novel-page__search-ico {
  color: var(--color-text-muted, #94a3b8);
  flex-shrink: 0;
}

.novel-page__search-go {
  flex-shrink: 0;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: var(--accent, #2c3d56);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
}

.novel-page__cats {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
  margin-bottom: 6px;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
}

.novel-cat-pill {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 11px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 999px;
  background: var(--color-card, #fff);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text, #1e293b);
  cursor: pointer;
  white-space: nowrap;

  &--active {
    border-color: var(--accent, #2c3d56);
    background: var(--accent-soft, rgba(44, 61, 86, 0.08));
    color: var(--accent, #2c3d56);
  }
}

.novel-cat-pill__n {
  font-size: 10px;
  font-weight: 700;
  opacity: 0.75;
}

.novel-page__ctx {
  margin: 0 0 6px;
  font-size: 11px;
  color: var(--color-text-muted, #94a3b8);

  strong {
    color: var(--accent, #2c3d56);
    font-weight: 700;
  }
}

.novel-feed {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.novel-feed__empty {
  text-align: center;
  padding: 24px;
  font-size: 13px;
  color: var(--color-text-muted, #94a3b8);
}

.novel-feed__more {
  padding: 8px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 8px;
  background: var(--color-card, #fff);
  font-size: 12px;
  color: var(--accent, #2c3d56);
  cursor: pointer;
}
</style>
