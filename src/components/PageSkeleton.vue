<script setup lang="ts">
import { computed } from 'vue'

/**
 * 通用骨架屏：variant 决定形态，count 控制条数（缺省按形态给合理值）。
 * feed——信息流卡片  list——带头像的列表行  grid——图片卡片网格
 * detail——详情页（标题+正文+配图）  reader——正文多行
 */
const props = withDefaults(defineProps<{
  variant?: 'feed' | 'list' | 'grid' | 'detail' | 'reader'
  count?: number
}>(), {
  variant: 'feed',
  count: undefined,
})

const defaults: Record<string, number> = { feed: 4, list: 5, grid: 8, detail: 1, reader: 12 }
const n = computed(() => props.count ?? defaults[props.variant])
</script>

<template>
  <div class="sk" :class="`sk--${props.variant}`" aria-hidden="true">
    <template v-if="props.variant === 'feed'">
      <div v-for="i in n" :key="i" class="sk__card">
        <div class="sk__row">
          <span class="skb skb--circle" style="width: 38px; height: 38px" />
          <span class="skb" style="width: 30%; height: 13px" />
          <span class="skb" style="width: 14%; height: 13px; margin-left: auto" />
        </div>
        <span class="skb" style="width: 58%; height: 17px" />
        <span class="skb" style="width: 100%; height: 12px" />
        <span class="skb" style="width: 86%; height: 12px" />
        <span class="skb" style="width: 100%; height: 150px; border-radius: 10px" />
        <div class="sk__row">
          <span class="skb skb--chip" />
          <span class="skb skb--chip" />
          <span class="skb skb--chip" />
        </div>
      </div>
    </template>

    <template v-else-if="props.variant === 'list'">
      <div v-for="i in n" :key="i" class="sk__row sk__row--wrap0">
        <span class="skb skb--circle" style="width: 42px; height: 42px; flex-shrink: 0" />
        <div class="sk__stack">
          <span class="skb" style="width: 45%; height: 13px" />
          <span class="skb" style="width: 72%; height: 12px" />
        </div>
      </div>
    </template>

    <template v-else-if="props.variant === 'grid'">
      <div v-for="i in n" :key="i" class="sk__grid-card">
        <span class="skb" style="width: 100%; aspect-ratio: 1 / 1; border-radius: 10px" />
        <span class="skb" style="width: 80%; height: 13px" />
        <span class="skb" style="width: 40%; height: 13px" />
      </div>
    </template>

    <template v-else-if="props.variant === 'detail'">
      <div v-for="i in n" :key="i" class="sk__stack sk--detail-inner">
        <span class="skb" style="width: 62%; height: 22px" />
        <span class="skb" style="width: 34%; height: 13px" />
        <span class="skb" style="width: 100%; height: 12px" />
        <span class="skb" style="width: 96%; height: 12px" />
        <span class="skb" style="width: 88%; height: 12px" />
        <span class="skb" style="width: 100%; height: 220px; border-radius: 12px" />
        <span class="skb" style="width: 92%; height: 12px" />
        <span class="skb" style="width: 70%; height: 12px" />
      </div>
    </template>

    <template v-else>
      <span
        v-for="i in n"
        :key="i"
        class="skb sk__reader-line"
        :style="{ width: `${[100, 96, 88, 94, 100, 76][i % 6]}%` }"
      />
    </template>
  </div>
</template>

<style scoped>
.sk {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}

.sk--grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.sk__card,
.sk__grid-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  background: var(--color-card, rgba(255, 255, 255, 0.85));
  box-shadow: var(--color-card-shadow, 0 1px 4px rgba(0, 0, 0, 0.06));
}

.sk__grid-card {
  padding: 10px;
}

.sk__row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.sk__stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.sk--detail-inner {
  gap: 12px;
}

.skb {
  position: relative;
  display: block;
  overflow: hidden;
  background: var(--sk-base, rgba(120, 130, 150, 0.18));
  border-radius: 6px;
  flex-shrink: 0;
}

.skb--circle {
  border-radius: 50%;
}

.skb--chip {
  width: 64px;
  height: 22px;
  border-radius: 11px;
}

.skb::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 35%, var(--sk-sheen, rgba(255, 255, 255, 0.55)) 50%, transparent 65%);
  background-size: 200% 100%;
  animation: sk-slide 1.35s ease-in-out infinite;
}

/* 相邻块错峰，流光更自然 */
.sk__card > .skb:nth-child(2)::after {
  animation-delay: 0.08s;
}

.sk__card > .skb:nth-child(3)::after {
  animation-delay: 0.16s;
}

.sk__card > .skb:nth-child(4)::after {
  animation-delay: 0.24s;
}

.sk__card > .skb:nth-child(5)::after {
  animation-delay: 0.32s;
}

.sk__reader-line {
  height: 15px;
}

@keyframes sk-slide {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skb::after {
    animation: none;
  }
}
</style>
