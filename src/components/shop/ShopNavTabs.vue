<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const tabs = [
  { path: '/shop', label: '商城', icon: 'tabler:shopping-bag', match: (p: string) => /^\/shop\/?$/.test(p) || p.includes('/productdetail') },
  { path: '/shop/myproducts', label: '我的', icon: 'tabler:package', match: (p: string) => /myproducts/.test(p) },
  { path: '/shop/sale', label: '发布', icon: 'tabler:plus', match: (p: string) => /\/sale/.test(p) },
  { path: '/messages', label: '消息', icon: 'tabler:message', match: (p: string) => p.startsWith('/messages') },
]

function isActive(tab: (typeof tabs)[0]) {
  return tab.match(route.path)
}

function go(path: string) {
  if (route.path !== path)
    router.push(path)
}
</script>

<template>
  <nav class="shop-nav-tabs" aria-label="商城导航">
    <button
      v-for="tab in tabs"
      :key="tab.path"
      type="button"
      class="shop-nav-tabs__item"
      :class="{ 'shop-nav-tabs__item--active': isActive(tab) }"
      @click="go(tab.path)"
    >
      <Icon :icon="tab.icon" width="20" height="20" aria-hidden="true" />
      <span>{{ tab.label }}</span>
    </button>
  </nav>
</template>
