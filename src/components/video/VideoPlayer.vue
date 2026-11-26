<script setup lang="ts">
import type { PublicVideo } from '@/types/video'
import BilibiliVideoPlayer from './BilibiliVideoPlayer.vue'
import SelfHostedVideoPlayer from './SelfHostedVideoPlayer.vue'

defineProps<{
  video: PublicVideo
}>()

defineEmits<{
  play: []
  milestone: [percent: 25 | 50 | 75 | 100]
}>()
</script>

<template>
  <div class="video-player">
    <BilibiliVideoPlayer
      v-if="video.sourceType === 'bilibili' && video.bilibiliBVID"
      :bvid="video.bilibiliBVID"
      @play="$emit('play')"
    />
    <SelfHostedVideoPlayer
      v-else-if="video.sourceType === 'mp4' || video.sourceType === 'hls'"
      :video="video"
      @play="$emit('play')"
      @milestone="$emit('milestone', $event)"
    />
    <div v-else class="video-player__failed" role="status">
      <p>暂不支持播放此视频</p>
      <a
        v-if="video.externalPageURL"
        :href="video.externalPageURL"
        target="_blank"
        rel="noopener noreferrer"
      >打开来源页面</a>
    </div>
  </div>
</template>

<style scoped>
.video-player {
  overflow: hidden;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  background: #000;
}

.video-player__failed {
  display: grid;
  place-items: center;
  gap: 12px;
  width: 100%;
  height: 100%;
  color: #e2e8f0;
  text-align: center;
  background: #0f172a;
}

.video-player__failed p {
  margin: 0;
  font-size: 14px;
}

.video-player__failed a {
  color: #38bdf8;
}
</style>
