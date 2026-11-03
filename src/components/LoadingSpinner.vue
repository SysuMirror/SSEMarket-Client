<script setup lang="ts">
/** 上传/加载中的统一转圈指示器：继承 currentColor，SMIL 旋转不依赖外部 CSS 动画。 */
defineProps<{
  /** 直径像素，默认 16 */
  size?: number
}>()
</script>

<template>
  <svg
    class="loading-spinner"
    :width="size ?? 16"
    :height="size ?? 16"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" stroke-opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round">
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 12 12"
        to="360 12 12"
        dur="0.8s"
        repeatCount="indefinite"
      />
    </path>
  </svg>
</template>

<style scoped>
.loading-spinner {
  display: inline-block;
  vertical-align: -3px;
}
</style>
