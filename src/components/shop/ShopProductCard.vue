<script setup lang="ts">
import type { ShopProduct } from '@/api/shop/types'
import { RouterLink } from 'vue-router'
import { shopProductPath } from '@/utils/shopRoute'

defineProps<{
  product: ShopProduct
}>()
</script>

<template>
  <RouterLink
    class="shop-product-card"
    :class="{ 'shop-product-card--sold': product.ISSold }"
    :to="shopProductPath(product.ProductID)"
  >
    <div class="shop-product-card__cover">
      <img
        v-if="product.Photos?.[0]"
        :src="product.Photos[0]"
        :alt="product.Name"
        loading="lazy"
      >
      <span v-if="product.ISSold" class="shop-product-card__sold-badge">已售出</span>
    </div>
    <div class="shop-product-card__body">
      <h3 class="shop-product-card__name">
        {{ product.Name }}
      </h3>
      <p class="shop-product-card__desc">
        {{ product.Description }}
      </p>
      <div class="shop-product-card__meta">
        <span class="shop-product-card__price">¥{{ product.Price }}</span>
      </div>
    </div>
  </RouterLink>
</template>
