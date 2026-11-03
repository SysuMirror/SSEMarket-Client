<script setup lang="ts">
import { computed, ref } from 'vue'

defineOptions({ name: 'NovelCover' })

const props = defineProps<{
  title: string
  coverUrl?: string // 1. 这里改成 coverUrl
}>()

const failedURL = ref('')

// 2. 这里也改成 props.coverUrl
const showImg = computed(() => Boolean(props.coverUrl) && failedURL.value !== props.coverUrl)

const hue = computed(() => {
  let h = 0
  for (const ch of props.title)
    h = (h * 31 + (ch.codePointAt(0) ?? 0)) % 360
  return h
})

const placeholderBg = computed(() => {
  const h1 = hue.value
  const h2 = (hue.value + 42) % 360
  return `linear-gradient(160deg, hsl(${h1} 42% 40%), hsl(${h2} 48% 24%))`
})

const titleFontSize = computed(() => {
  const n = Array.from(props.title).length
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
      :src="coverUrl"
      :alt="title"
      loading="lazy" decoding="async"
      @error="failedURL = coverUrl ?? ''"
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
