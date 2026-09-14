<script lang="ts" setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const mainTabs = [
  { to: '/', label: '主页' },
  { to: '/smart-xiaoqiu', label: '小秋' },
  { to: '/partitions', label: '分区' },
  { to: '/rating', label: '打分' },
  { to: '/shop', label: '商城' },
]

const isTabActive = (to: string) => {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>

<template>
  <nav class="partition-strip-wrap" role="list">
    <RouterLink
      v-for="tab in mainTabs"
      :key="tab.to"
      :to="tab.to"
      class="partition-tab"
      :class="{ 'partition-tab--active': isTabActive(tab.to) }"
      role="listitem"
    >
      <span class="partition-tab__label">{{ tab.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped lang="scss">
.partition-strip-wrap {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  box-sizing: border-box;
  background: var(--color-card, #fff);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);

  @supports (background: color-mix(in srgb, white 80%, transparent)) {
    background: color-mix(in srgb, var(--color-card, #fff) 82%, transparent);
  }
}

.partition-tab {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 0 8px;
  text-decoration: none;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  -webkit-tap-highlight-color: transparent;
  position: relative;
  transition: color 0.15s ease;

  &:active {
    opacity: 0.7;
  }

  &__label {
    font-size: 15px;
    font-weight: 400;
    line-height: 1.3;
    white-space: nowrap;
  }

  &--active {
    color: var(--color-text);

    .partition-tab__label {
      font-weight: 600;
      font-size: 16px;
    }

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 20px;
      height: 3px;
      border-radius: 2px;
      background: var(--accent);
    }
  }
}
</style>
