<script lang="ts" setup>
import type { Ref } from 'vue'
import { computed, defineAsyncComponent, inject } from 'vue'
import { useRoute } from 'vue-router'
import ShopNavTabs from '@/components/shop/ShopNavTabs.vue'

const ShopSidebar = defineAsyncComponent(
  () => import('@/components/ShopSidebar.vue'),
)

const route = useRoute()
const isPC = inject('isPC') as Ref<boolean>

const showShopChrome = computed(() => {
  const p = route.path
  return p === '/shop'
    || p === '/shop/myproducts'
    || p.startsWith('/shop/productdetail')
    || p === '/shop/sale'
})

const showPcSidebar = computed(() => isPC.value && showShopChrome.value)
const showMobileNav = computed(() => !isPC.value && showShopChrome.value)
</script>

<template>
  <div class="shop-layout shop-zone">
    <aside v-if="showPcSidebar" class="shop-layout__aside" aria-label="商城侧栏">
      <ShopSidebar />
    </aside>
    <div class="shop-layout__main">
      <ShopNavTabs v-if="showMobileNav" class="shop-layout__tabs" />
      <div class="shop-layout__scroll">
        <RouterView />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.shop-layout {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 0 8px 8px;
  box-sizing: border-box;
}

.shop-layout__aside {
  flex: 0 0 132px;
  position: sticky;
  top: 4px;
  align-self: flex-start;
}

.shop-layout__main {
  flex: 1;
  min-width: 0;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

.shop-layout__tabs {
  flex-shrink: 0;
  position: sticky;
  top: -10px;
  z-index: 3;
  margin: -10px -8px 6px;
  padding: 0 8px;
  background: var(--shop-bg, var(--chat-bg-main, #f4f5f7));
}

@media screen and (max-width: 768px) {
  .shop-layout {
    padding: 0 0 8px;
  }

  .shop-layout__tabs {
    top: 0;
    margin: 0 0 6px;
    padding: 0 12px;
  }
}

.shop-layout__scroll {
  flex: 1;
  min-width: 0;
  width: 100%;
}
</style>
