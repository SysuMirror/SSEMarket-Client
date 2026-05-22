<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  SHOP_CAROUSEL_COVER_SUBTITLE,
  SHOP_CAROUSEL_COVER_TITLE,
  SHOP_CAROUSEL_COVER_URL,
} from '@/constants/shopCarousel'

const props = withDefaults(
  defineProps<{
    urls?: string[]
    intervalMs?: number
  }>(),
  { urls: () => [], intervalMs: 4500 },
)

const index = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const slides = ref<{ image: string, title: string, subtitle: string }[]>([])

function buildSlides() {
  const list: { image: string, title: string, subtitle: string }[] = [
    {
      image: SHOP_CAROUSEL_COVER_URL,
      title: SHOP_CAROUSEL_COVER_TITLE,
      subtitle: SHOP_CAROUSEL_COVER_SUBTITLE,
    },
  ]
  for (const url of props.urls) {
    if (url && url !== SHOP_CAROUSEL_COVER_URL)
      list.push({ image: url, title: '在售好物', subtitle: '点击进入详情' })
  }
  slides.value = list.slice(0, 6)
  if (index.value >= slides.value.length)
    index.value = 0
}

function startAutoplay() {
  stopAutoplay()
  if (slides.value.length <= 1)
    return
  timer = setInterval(() => {
    index.value = (index.value + 1) % slides.value.length
  }, props.intervalMs)
}

function stopAutoplay() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

watch(() => props.urls, buildSlides, { immediate: true, deep: true })
watch(slides, startAutoplay)

onMounted(startAutoplay)
onBeforeUnmount(stopAutoplay)
</script>

<template>
  <section v-if="slides.length" class="shop-hero" aria-label="商城轮播">
    <div class="shop-hero__track">
      <div
        v-for="(slide, i) in slides"
        :key="slide.image + i"
        class="shop-hero__slide"
        :class="{ 'shop-hero__slide--active': i === index }"
      >
        <img class="shop-hero__img" :src="slide.image" :alt="slide.title" loading="lazy">
        <div class="shop-hero__caption">
          <h3>{{ slide.title }}</h3>
          <p v-if="slide.subtitle">
            {{ slide.subtitle }}
          </p>
        </div>
      </div>
    </div>
    <div v-if="slides.length > 1" class="shop-hero__dots">
      <button
        v-for="(_, i) in slides"
        :key="i"
        type="button"
        class="shop-hero__dot"
        :class="{ 'shop-hero__dot--active': i === index }"
        :aria-label="`第 ${i + 1} 张`"
        @click="index = i"
      />
    </div>
  </section>
</template>
