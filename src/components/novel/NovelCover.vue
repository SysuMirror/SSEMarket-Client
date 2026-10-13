<script setup lang="ts">
import { computed, ref } from 'vue'

defineOptions({ name: 'NovelCover' })

const { title, coverURL } = defineProps<{
  title: string
  coverURL?: string
}>()

/** 加载失败的封面不再重试：记住失败的 URL，换 URL 后自动恢复。 */
const failedURL = ref('')
const showImg = computed(() => Boolean(coverURL) && failedURL.value !== coverURL)

/** 标题哈希 → 稳定配色：同一本书每次渲染颜色一致，不同书颜色不同。 */
const hue = computed(() => {
  let h = 0
  for (const ch of title)
    h = (h * 31 + (ch.codePointAt(0) ?? 0)) % 360
  return h
})
const placeholderBg = computed(() => {
  const h1 = hue.value
  const h2 = (hue.value + 42) % 360
  return `linear-gradient(160deg, hsl(${h1} 42% 40%), hsl(${h2} 48% 24%))`
})
const titleFontSize = computed(() => {
  const n = Array.from(title).length
  if (n <= 4)
    return '15px'
  if (n <= 8)
    return '12px'
  return '10px'
})
</script>

<template>
  <span class="novel-cover" :style="showImg ? undefined : { background: placeholderBg }">
    <img
      v-if="showImg"
      :src="coverURL"
      :alt="title"
      loading="lazy"
      @error="failedURL = coverURL ?? ''"
    >
    <span v-else class="novel-cover__text" :style="{ fontSize: titleFontSize }">
      {{ title || '未命名' }}
    </span>
  </span>
</template>

<style scoped lang="scss">
/* 尺寸 / 圆角由使用方在组件标签上给（scoped 样式作用于子组件根元素）。 */
.novel-cover {
  position: relative;
  display: block;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.novel-cover__text {
  position: absolute;
  inset: 0;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  align-items: center;
  justify-content: center;
  padding: 8% 10%;
  box-sizing: border-box;
  overflow: hidden;
  color: #fff;
  font-weight: 700;
  line-height: 1.4;
  text-align: center;
  word-break: break-all;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}
</style>
