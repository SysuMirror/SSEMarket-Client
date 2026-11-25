<script setup lang="ts">
import { trackEvia } from '@/analytics/evia'
import type { ShopProduct } from '@/api/shop/types'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getShopCarousel, getShopProducts } from '@/api/shop'
import PageSkeleton from '@/components/PageSkeleton.vue'
import ShopHeroCarousel from '@/components/shop/ShopHeroCarousel.vue'
import ShopProductCard from '@/components/shop/ShopProductCard.vue'

defineOptions({ name: 'ShopView' })

const PRICE_RANGES = [
  { value: '', label: '全部' },
  { value: '0-20', label: '≤20' },
  { value: '0-50', label: '≤50' },
  { value: '0-100', label: '≤100' },
  { value: '0-500', label: '≤500' },
  { value: '500-1000000', label: '500+' },
] as const

const MY_STATUS = [
  { value: '', label: '全部' },
  { value: 'onsale', label: '在售' },
  { value: 'sold', label: '已售出' },
] as const

const route = useRoute()
const router = useRouter()

const isMain = computed(() => route.name === 'Shop' || /^\/shop\/?$/.test(route.path))
const products = ref<ShopProduct[]>([])
const carouselUrls = ref<string[]>([])
const searchKeyword = ref('')
const priceRange = ref('')
const myStatus = ref('')
const loading = ref(true)

const filteredProducts = computed(() => {
  let list = products.value
  if (!isMain.value) {
    if (myStatus.value === 'onsale')
      list = list.filter(p => !p.ISSold)
    else if (myStatus.value === 'sold')
      list = list.filter(p => p.ISSold)
  }
  else if (priceRange.value) {
    const [min, max] = priceRange.value.split('-')
    const minPrice = Number.parseInt(min, 10)
    list = list.filter((p) => {
      if (!max || max === '1000000' || max === '+')
        return p.Price >= minPrice
      const maxPrice = Number.parseInt(max, 10)
      return p.Price >= minPrice && p.Price <= maxPrice
    })
  }
  return list
})

const statsText = computed(() => {
  const n = products.value.length
  const onsale = products.value.filter(p => !p.ISSold).length
  if (isMain.value)
    return `在售 ${onsale} 件`
  return `共 ${n} 件 · 在售 ${onsale}`
})

async function loadProducts() {
  loading.value = true
  try {
    trackEvia('shop_browsed', { tab: isMain.value ? 'home' : 'history' })
    products.value = await getShopProducts({
      searchsort: isMain.value ? 'home' : 'history',
      searchinfo: searchKeyword.value.trim(),
      limit: 80,
    })
    if (isMain.value)
      carouselUrls.value = await getShopCarousel()
  }
  finally {
    loading.value = false
  }
}

onMounted(loadProducts)
watch(() => route.path, () => {
  if (route.path === '/shop' || route.path === '/shop/myproducts')
    loadProducts()
})
</script>

<template>
  <div class="shop-zone shop-page">
    <header class="shop-page__head">
      <div class="shop-page__head-text">
        <h1 class="shop-page__title">
          {{ isMain ? '逛逛好物' : '我的商品' }}
        </h1>
        <p class="shop-page__sub">
          {{ statsText }}
        </p>
      </div>
      <button type="button" class="shop-page__publish" @click="router.push('/shop/sale')">
        <Icon icon="tabler:plus" width="14" height="14" />
        <span>发布</span>
      </button>
    </header>

    <section class="shop-page__hero">
      <ShopHeroCarousel v-if="isMain" :urls="carouselUrls" />
      <div v-else class="shop-page__hero-placeholder">
        <Icon icon="tabler:package" width="22" height="22" />
        <span>管理你发布的商品</span>
      </div>
    </section>

    <div class="shop-page__search">
      <Icon icon="tabler:search" width="15" height="15" class="shop-page__search-ico" />
      <input
        v-model="searchKeyword"
        type="search"
        :placeholder="isMain ? '搜索商品名或描述' : '搜索我的商品'"
        @keydown.enter="loadProducts"
      >
      <button type="button" class="shop-page__search-go" @click="loadProducts">
        搜索
      </button>
    </div>

    <nav class="shop-page__chips" role="group" :aria-label="isMain ? '价格筛选' : '状态筛选'">
      <template v-if="isMain">
        <button
          v-for="r in PRICE_RANGES"
          :key="r.value"
          type="button"
          class="shop-page__chip"
          :class="{ 'shop-page__chip--on': priceRange === r.value }"
          @click="priceRange = r.value"
        >
          {{ r.label }}
        </button>
      </template>
      <template v-else>
        <button
          v-for="s in MY_STATUS"
          :key="s.value"
          type="button"
          class="shop-page__chip"
          :class="{ 'shop-page__chip--on': myStatus === s.value }"
          @click="myStatus = s.value"
        >
          {{ s.label }}
        </button>
      </template>
    </nav>

    <PageSkeleton v-if="loading" class="shop-page__skeleton" variant="grid" :count="8" />

    <div v-else-if="filteredProducts.length === 0" class="shop-page__state shop-page__state--empty">
      <Icon :icon="isMain ? 'tabler:mood-empty' : 'tabler:package-off'" width="32" height="32" />
      <p>{{ isMain ? '暂无在售商品' : '还没有发布商品' }}</p>
      <button type="button" class="shop-page__state-cta" @click="router.push('/shop/sale')">
        去发布
      </button>
    </div>

    <div v-else class="shop-page__list">
      <ShopProductCard
        v-for="p in filteredProducts"
        :key="p.ProductID"
        :product="p"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.shop-page {
  width: 100%;
  padding: 0 0 6px;
  box-sizing: border-box;
}

.shop-page__head {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.shop-page__head-text {
  flex: 1;
  min-width: 0;
}

.shop-page__title {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--shop-text, var(--chat-text));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shop-page__sub {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--shop-muted, var(--chat-text-secondary));
  white-space: nowrap;
}

.shop-page__publish {
  flex-shrink: 0;
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 3px;
  padding: 6px 10px;
  border: none;
  border-radius: 7px;
  background: var(--chat-accent);
  color: var(--chat-unread-text, #fff);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.shop-page__hero {
  margin-bottom: 6px;

  :deep(.shop-hero) {
    margin-bottom: 0;
  }
}

.shop-page__hero-placeholder {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 120px;
  border: 1px dashed var(--shop-border, var(--chat-border));
  border-radius: 8px;
  background: var(--shop-card, var(--chat-bg-elevated));
  color: var(--shop-muted, var(--chat-text-secondary));
  font-size: 12px;
  white-space: nowrap;
}

.shop-page__search {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  padding: 3px 3px 3px 8px;
  border: 1px solid var(--shop-border, var(--chat-border));
  border-radius: 8px;
  background: var(--shop-card, var(--chat-bg-elevated));
}

.shop-page__search-ico {
  flex-shrink: 0;
  color: var(--shop-muted, var(--chat-text-secondary));
}

.shop-page__search input {
  flex: 1;
  min-width: 0;
  min-height: 28px;
  border: none;
  outline: none;
  font-size: 12px;
  color: var(--shop-text, var(--chat-text));
  background: transparent;

  &::placeholder {
    color: var(--shop-muted, var(--chat-text-secondary));
    opacity: 0.85;
  }
}

.shop-page__search-go {
  flex-shrink: 0;
  padding: 5px 10px;
  border: none;
  border-radius: 6px;
  background: var(--chat-accent-soft, #fff5eb);
  color: var(--chat-accent);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.shop-page__chips {
  display: flex;
  flex-wrap: nowrap;
  gap: 5px;
  margin-bottom: 6px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.shop-page__chip {
  flex: 0 0 auto;
  padding: 4px 10px;
  border: 1px solid var(--shop-border, var(--chat-border));
  border-radius: 999px;
  background: var(--shop-card, var(--chat-bg-elevated));
  font-size: 11px;
  font-weight: 600;
  color: var(--shop-muted, var(--chat-text-secondary));
  white-space: nowrap;
  cursor: pointer;

  &--on {
    border-color: var(--chat-accent);
    background: var(--chat-accent-soft, #fff5eb);
    color: var(--chat-accent);
  }
}

.shop-page__state {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 96px;
  padding: 12px;
  color: var(--shop-muted, var(--chat-text-secondary));
  font-size: 12px;
}

.shop-page__state--empty {
  flex-direction: column;
  flex-wrap: wrap;
  border: 1px dashed var(--shop-border, var(--chat-border));
  border-radius: 8px;
  background: var(--shop-card, var(--chat-bg-elevated));
}

.shop-page__state-cta {
  padding: 6px 14px;
  border: none;
  border-radius: 7px;
  background: var(--chat-accent);
  color: var(--chat-unread-text, #fff);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.shop-page__spin {
  animation: shop-spin 0.8s linear infinite;
}

@keyframes shop-spin {
  to {
    transform: rotate(360deg);
  }
}

.shop-page__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
