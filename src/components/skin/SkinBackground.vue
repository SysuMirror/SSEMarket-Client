<script setup lang="ts">
import { useSkin } from '@/composables/useSkin'

/**
 * 全站背景层：fixed 铺满视口，object-fit: cover 保证任何比例都不拉伸。
 * 图片由 useSkin 决定：皮肤自带背景或用户上传的图床图片。
 * 关闭背景时 backgroundSources 为 null，整层不渲染，页面回到原样。
 */
const { backgroundSources } = useSkin()
</script>

<template>
  <div v-if="backgroundSources" class="skin-background" aria-hidden="true">
    <picture>
      <source :srcset="backgroundSources.desktop" media="(min-width: 769px)">
      <img
        :src="backgroundSources.mobile"
        alt=""
        decoding="async"
        fetchpriority="low"
        draggable="false"
      >
    </picture>
    <div class="skin-background__scrim" />
  </div>
</template>

<style scoped lang="scss">
.skin-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background: #eaf2ff;
}

.skin-background img {
  display: block;
  width: 100%;
  height: 100%;
  /* cover 只裁切、不拉伸；人物在画面中部，裁切安全 */
  object-fit: cover;
  object-position: center 40%;
  user-select: none;
}

.skin-background__scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(250, 252, 255, 0.12) 0%, rgba(246, 249, 255, 0.26) 46%, rgba(240, 246, 255, 0.46) 100%),
    radial-gradient(120% 80% at 50% 0%, rgba(255, 255, 255, 0.24), transparent 62%);
}

:global(body.dark-mode) .skin-background {
  background: #0b1424;
}

:global(body.dark-mode) .skin-background__scrim {
  background:
    linear-gradient(180deg, rgba(8, 15, 30, 0.5) 0%, rgba(8, 15, 30, 0.62) 55%, rgba(8, 15, 30, 0.74) 100%),
    radial-gradient(120% 80% at 50% 0%, rgba(26, 45, 80, 0.2), transparent 62%);
}
</style>
