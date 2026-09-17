<script setup lang="ts">
defineProps<{
  bvid: string
}>()

defineEmits<{
  play: []
}>()
</script>

<template>
  <iframe
    class="bili-frame"
    :src="`https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&page=1&autoplay=0&danmaku=0&high_quality=1`"
    allowfullscreen
    referrerpolicy="strict-origin-when-cross-origin"
    title="Bilibili video player"
    @load="$emit('play')"
  />
</template>

<style scoped>
.bili-frame {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 0;
  background: #000;
}
</style>
