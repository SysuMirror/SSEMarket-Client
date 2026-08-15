<script setup lang="ts">
import type { ShopProduct } from '@/api/shop/types'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { deleteShopProduct, markShopProductSold } from '@/api/shop/mutations'
import { getShopProductDetail } from '@/api/shop'
import { showImg } from '@/components/ImageShower'
import { showMsg } from '@/components/MessageBox'
import { useUserStore } from '@/store/userStore'
import { getSellerName } from '@/utils/sellerNameMapper'
import { strHandler } from '@/utils/strHandler'

defineOptions({ name: 'ProductView' })

const route = useRoute()
const router = useRouter()
const { userInfo } = useUserStore()

const product = ref<ShopProduct | null>(null)
const sellerLabel = ref('')
const imageIndex = ref(0)
const loading = ref(true)

const isOwner = computed(() => product.value && product.value.SellerID === userInfo.userID)
const canBuy = computed(() => product.value && !product.value.ISSold)
const hasImages = computed(() => (product.value?.Photos?.length ?? 0) > 0)

function formatTime(t?: string) {
  if (!t)
    return ''
  const d = new Date(t)
  if (Number.isNaN(d.getTime()))
    return t
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function loadDetail() {
  const id = Number(route.params.ProductID)
  if (!Number.isFinite(id) || id <= 0) {
    router.replace('/shop')
    return
  }
  loading.value = true
  try {
    const detail = await getShopProductDetail(id)
    if (!detail) {
      showMsg('商品不存在')
      router.replace('/shop')
      return
    }
    product.value = detail
    imageIndex.value = 0
    if (detail.SellerID > 0) {
      try {
        sellerLabel.value = await getSellerName(detail.SellerID)
      }
      catch {
        sellerLabel.value = detail.Seller || '卖家'
      }
    }
    else {
      sellerLabel.value = detail.Seller || '匿名卖家'
    }
  }
  finally {
    loading.value = false
  }
}

function chatWithSeller(anonymous: boolean) {
  if (!canBuy.value || !product.value?.SellerID)
    return
  router.push({
    path: '/messages',
    query: {
      tab: 'chat',
      user: String(product.value.SellerID),
      ...(anonymous ? { anonymous: '1' } : {}),
    },
  })
}

async function markSold() {
  if (!product.value || !confirm('确认标记为已售出？'))
    return
  if (await markShopProductSold(product.value.ProductID)) {
    product.value.ISSold = true
    showMsg('已标记售出')
  }
  else {
    showMsg('操作失败')
  }
}

async function removeProduct() {
  if (!product.value || !confirm('确定删除该商品？'))
    return
  if (await deleteShopProduct(product.value.ProductID)) {
    showMsg('已删除')
    router.push('/shop/myproducts')
  }
  else {
    showMsg('删除失败')
  }
}

function onImageClick(event: MouseEvent) {
  const el = event.target as HTMLElement
  if (el?.tagName === 'IMG' && product.value?.Photos?.length) {
    const url = product.value.Photos[imageIndex.value]
    if (url)
      showImg(strHandler('postImg', url))
  }
}

onMounted(loadDetail)
watch(() => route.params.ProductID, loadDetail)
</script>

<template>
  <div
    class="shop-detail shop-zone"
    :class="{ 'shop-detail--sold': product?.ISSold }"
    @click="onImageClick"
  >
    <header class="shop-detail__nav">
      <button type="button" class="shop-detail__back" aria-label="返回" @click="router.back()">
        <Icon icon="tabler:arrow-left" width="18" height="18" />
      </button>
      <span class="shop-detail__nav-title">商品详情</span>
    </header>

    <div v-if="loading" class="shop-detail__loading">
      加载中…
    </div>

    <template v-else-if="product">
      <article class="shop-detail__card">
        <div v-if="hasImages" class="shop-detail__gallery">
          <img
            :src="product.Photos[imageIndex]"
            :alt="product.Name"
            class="shop-detail__main-img"
          >
          <div v-if="product.Photos.length > 1" class="shop-detail__thumbs">
            <button
              v-for="(url, i) in product.Photos"
              :key="i"
              type="button"
              class="shop-detail__thumb"
              :class="{ 'shop-detail__thumb--on': i === imageIndex }"
              @click.stop="imageIndex = i"
            >
              <img :src="url.replace('/uploads/', '/resized/')" alt="">
            </button>
          </div>
        </div>
        <div v-else class="shop-detail__no-img">
          <Icon icon="tabler:photo-off" width="32" height="32" />
        </div>

        <span v-if="product.ISSold" class="shop-detail__sold-tag">已售出</span>

        <h1 class="shop-detail__title">
          {{ product.Name }}
        </h1>
        <p class="shop-detail__price">
          ¥{{ product.Price }}
        </p>
        <p class="shop-detail__meta">
          <span>{{ sellerLabel }}</span>
          <span>{{ formatTime(product.PostTime) }}</span>
        </p>
        <div class="shop-detail__desc">
          {{ product.Description }}
        </div>
      </article>

      <footer class="shop-detail__actions">
        <template v-if="isOwner">
          <button
            type="button"
            class="shop-detail__btn"
            :disabled="product.ISSold"
            @click="markSold"
          >
            标记售出
          </button>
          <button type="button" class="shop-detail__btn shop-detail__btn--danger" @click="removeProduct">
            删除
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            class="shop-detail__btn shop-detail__btn--primary"
            :disabled="!canBuy"
            @click="chatWithSeller(false)"
          >
            私聊卖家
          </button>
          <button
            type="button"
            class="shop-detail__btn"
            :disabled="!canBuy"
            @click="chatWithSeller(true)"
          >
            匿名私聊
          </button>
        </template>
      </footer>
    </template>
  </div>
</template>

<style scoped lang="scss">
.shop-detail {
  max-width: 720px;
  margin: 0 auto;
  padding: 4px 0 12px;
}

.shop-detail__nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.shop-detail__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--hp-border, var(--chat-border));
  border-radius: 8px;
  background: var(--hp-card, #fff);
  cursor: pointer;
}

.shop-detail__nav-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--hp-muted, var(--chat-text-secondary));
}

.shop-detail__loading {
  padding: 32px;
  text-align: center;
  font-size: 13px;
  color: var(--hp-muted, var(--chat-text-secondary));
}

.shop-detail__card {
  position: relative;
  padding: 12px;
  border: 1px solid var(--hp-border, var(--chat-border));
  border-radius: 10px;
  background: var(--hp-card, #fff);
}

.shop-detail__gallery {
  margin-bottom: 10px;
}

.shop-detail__main-img {
  width: 100%;
  max-height: 360px;
  object-fit: contain;
  border-radius: 8px;
  background: var(--chat-bg-muted, #f4f5f7);
}

.shop-detail__thumbs {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  overflow-x: auto;
}

.shop-detail__thumb {
  flex: 0 0 52px;
  height: 52px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;

  &--on {
    border-color: var(--chat-accent);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.shop-detail__no-img {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 160px;
  margin-bottom: 10px;
  border-radius: 8px;
  background: var(--chat-bg-muted, #f4f5f7);
  color: var(--hp-muted, var(--chat-text-secondary));
}

.shop-detail__sold-tag {
  display: inline-block;
  margin-bottom: 6px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: #c62828;
  border-radius: 4px;
}

.shop-detail__title {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.35;
}

.shop-detail__price {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 800;
  color: var(--chat-accent);
}

.shop-detail__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--hp-muted, var(--chat-text-secondary));
}

.shop-detail__desc {
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.shop-detail__actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  margin-top: 10px;
}

.shop-detail__btn {
  flex: 1 1 0;
  min-width: 0;
  padding: 8px 10px;
  white-space: nowrap;
  border: 1px solid var(--hp-border, var(--chat-border));
  border-radius: 8px;
  background: var(--hp-card, #fff);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--primary {
    border-color: var(--chat-accent);
    background: var(--chat-accent);
    color: var(--chat-unread-text, #fff);
  }

  &--danger {
    color: #c62828;
    border-color: rgba(198, 40, 40, 0.35);
  }
}

.shop-detail--sold .shop-detail__card {
  background: var(--chat-bg-muted, #f0f2f5);
}

.shop-detail--sold .shop-detail__main-img,
.shop-detail--sold .shop-detail__thumb img {
  filter: grayscale(0.85) brightness(0.72);
}

.shop-detail--sold .shop-detail__title,
.shop-detail--sold .shop-detail__desc,
.shop-detail--sold .shop-detail__meta {
  color: var(--hp-muted, var(--chat-text-secondary));
}

.shop-detail--sold .shop-detail__price {
  color: var(--hp-muted, var(--chat-text-secondary));
  font-weight: 600;
}

body.dark-mode .shop-detail--sold .shop-detail__card {
  background: rgba(255, 255, 255, 0.04);
}
</style>
