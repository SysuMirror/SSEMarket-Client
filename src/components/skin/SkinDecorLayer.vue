<script setup lang="ts">
import { computed } from 'vue'
import { useSkin } from '@/composables/useSkin'
import { skinStickerURL } from '@/skins'

/**
 * 桌面宽屏两侧的节日贴纸装饰。
 * 只在 >=1100px（内容两侧有真实留白）时显示，pointer-events: none，
 * 不遮挡任何可点击区域；手机端由横幅/开场画面承载节日元素。
 */
const { activeSkin } = useSkin()

const decor = computed(() => {
  const stickers = activeSkin.value?.stickers
  if (!activeSkin.value || !stickers || stickers.length < 12)
    return []
  return [
    { key: 'left-top', sticker: stickers[8], className: 'skin-decor__item--left-top' },
    { key: 'right-mid', sticker: stickers[7], className: 'skin-decor__item--right-mid' },
    { key: 'left-bottom', sticker: stickers[10], className: 'skin-decor__item--left-bottom' },
  ].map(item => ({
    ...item,
    url: skinStickerURL(activeSkin.value!.id, item.sticker.file),
  }))
})
</script>

<template>
  <div v-if="decor.length" class="skin-decor" aria-hidden="true">
    <img
      v-for="item in decor"
      :key="item.key"
      class="skin-decor__item"
      :class="item.className"
      :src="item.url"
      alt=""
      loading="lazy"
      decoding="async"
      draggable="false"
    >
  </div>
</template>

<style scoped lang="scss">
.skin-decor {
  display: none;
}

@media (min-width: 1100px) {
  .skin-decor {
    position: fixed;
    inset: 0;
    z-index: 0;
    display: block;
    pointer-events: none;
    overflow: hidden;
  }

  .skin-decor__item {
    position: absolute;
    width: 96px;
    height: 96px;
    object-fit: contain;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.72);
    box-shadow:
      0 8px 24px rgba(47, 91, 184, 0.12),
      0 1px 2px rgba(47, 91, 184, 0.1);
    border: 1px solid rgba(61, 111, 214, 0.14);
    opacity: 0.9;
    animation: skin-decor-float 9s ease-in-out infinite alternate;
    user-select: none;
  }

  .skin-decor__item--left-top {
    left: max(14px, calc(50vw - 492px));
    top: 26%;
    transform: rotate(-6deg);
  }

  .skin-decor__item--right-mid {
    right: max(14px, calc(50vw - 492px));
    top: 48%;
    transform: rotate(5deg);
    animation-delay: -3s;
  }

  .skin-decor__item--left-bottom {
    left: max(14px, calc(50vw - 486px));
    bottom: 14%;
    transform: rotate(4deg);
    animation-delay: -6s;
  }
}

@media (min-width: 1100px) and (max-width: 1240px) {
  .skin-decor__item {
    width: 80px;
    height: 80px;
    opacity: 0.82;
  }
}

:global(body.dark-mode) .skin-decor__item {
  background: rgba(30, 41, 59, 0.82);
  border-color: rgba(122, 167, 255, 0.18);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.32),
    0 1px 2px rgba(0, 0, 0, 0.3);
}

:global(body.pwa-sidebar-open) .skin-decor__item--left-top,
:global(body.pwa-sidebar-open) .skin-decor__item--left-bottom {
  display: none;
}

@keyframes skin-decor-float {
  from { translate: 0 0; }
  to { translate: 0 -10px; }
}

@media (prefers-reduced-motion: reduce) {
  .skin-decor__item {
    animation: none;
  }
}
</style>
