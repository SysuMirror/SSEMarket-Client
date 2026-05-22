<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const links = [
  { path: '/shop', label: '商城首页', icon: 'tabler:shopping-bag', match: (p: string) => /^\/shop\/?$/.test(p) || p.includes('/productdetail') },
  { path: '/shop/myproducts', label: '我的商品', icon: 'tabler:package', match: (p: string) => /myproducts/.test(p) },
  { path: '/shop/sale', label: '发布商品', icon: 'tabler:plus', match: (p: string) => /\/sale/.test(p) },
  { path: '/messages', label: '消息', icon: 'tabler:message', match: (p: string) => p.startsWith('/messages') },
  { path: '/', label: '返回主页', icon: 'tabler:home', match: (p: string) => p === '/' },
]

function isActive(link: (typeof links)[0]) {
  return link.match(route.path)
}
</script>

<template>
  <nav class="shop-sidebar" aria-label="商城导航">
    <p class="shop-sidebar__title">
      商城
    </p>
    <button
      v-for="link in links"
      :key="link.path"
      type="button"
      class="shop-sidebar__item"
      :class="{ 'shop-sidebar__item--on': isActive(link) }"
      @click="router.push(link.path)"
    >
      <Icon :icon="link.icon" width="18" height="18" aria-hidden="true" />
      <span>{{ link.label }}</span>
    </button>
  </nav>
</template>

<style scoped lang="scss">
.shop-sidebar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 10px;
  width: 100%;
  border: 1px solid var(--hp-border, var(--chat-border));
  border-radius: 10px;
  background: var(--hp-card, var(--chat-bg-elevated));
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.shop-sidebar__title {
  margin: 0 0 6px 4px;
  font-size: 12px;
  font-weight: 800;
  color: var(--hp-muted, var(--chat-text-secondary));
  letter-spacing: 0.04em;
}

.shop-sidebar__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  color: var(--hp-muted, var(--chat-text-secondary));
  cursor: pointer;
  text-align: left;

  &--on {
    background: var(--chat-accent-soft, #fff5eb);
    color: var(--chat-accent);
  }

  &:hover:not(&--on) {
    background: var(--chat-bg-muted, #f4f5f7);
  }
}
</style>
