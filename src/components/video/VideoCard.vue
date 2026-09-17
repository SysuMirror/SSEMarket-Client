<script setup lang="ts">
import type { PublicVideo } from '@/types/video'
import { computed } from 'vue'

defineOptions({
  name: 'VideoCard',
})

const props = defineProps<{
  video: PublicVideo
}>()

const duration = computed(() => {
  const total = Math.max(0, Math.floor(props.video.durationSec))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0)
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})

const publishDate = computed(() => {
  if (!props.video.publishedAt)
    return ''
  return new Date(props.video.publishedAt).toLocaleDateString('zh-CN')
})

const sourceLabel = computed(() =>
  props.video.sourceType === 'bilibili' ? 'B站视频' : '本站视频',
)
</script>

<template>
  <RouterLink class="video-card" :to="`/video/${video.videoID}`">
    <div class="cover">
      <img
        v-if="video.coverURL"
        :src="video.coverURL"
        :alt="video.title"
        loading="lazy"
      >
      <span class="duration">{{ duration }}</span>
      <span class="source">{{ sourceLabel }}</span>
    </div>
    <div class="info">
      <h3>{{ video.title }}</h3>
      <p v-if="publishDate">
        {{ publishDate }}
      </p>
    </div>
  </RouterLink>
</template>

<style scoped>
.video-card {
  display: block;
  overflow: hidden;
  color: inherit;
  text-decoration: none;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.video-card:hover {
  border-color: #94a3b8;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  transform: translateY(-2px);
}

.cover {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #e2e8f0;
}

.cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.duration,
.source {
  position: absolute;
  z-index: 1;
  padding: 3px 7px;
  color: #fff;
  font-size: 12px;
  line-height: 1.3;
  background: rgba(15, 23, 42, 0.78);
  border-radius: 4px;
}

.duration {
  right: 8px;
  bottom: 8px;
}

.source {
  top: 8px;
  left: 8px;
}

.info {
  padding: 12px 14px 14px;
}

.info h3 {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: #0f172a;
  font-size: 15px;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.info p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .video-card {
    transition: none;
  }

  .video-card:hover {
    transform: none;
  }
}
</style>
