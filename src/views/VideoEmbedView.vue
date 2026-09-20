<script setup lang="ts">
import type { PublicVideo } from '@/types/video'
import { ref, watch } from 'vue'
import { getVideo } from '@/api/video/getVideos'
import { recordVideoPlayed } from '@/api/video/recordPlayed'
import VideoPlayer from '@/components/video/VideoPlayer.vue'
import { parseVideoReference } from '@/utils/videoEmbed'
import { setTitle } from '@/utils/title'

const props = defineProps<{ videoID: string }>()

const video = ref<PublicVideo>()
const loading = ref(true)
const errorMessage = ref('')

async function loadVideo() {
  const id = parseVideoReference(props.videoID)
  if (!id) {
    loading.value = false
    errorMessage.value = '视频引用无效'
    return
  }

  loading.value = true
  errorMessage.value = ''
  try {
    video.value = await getVideo(id)
    if (video.value.title)
      setTitle(`${video.value.title} - 集市视频`)
  }
  catch {
    errorMessage.value = '视频不存在或暂时无法播放'
  }
  finally {
    loading.value = false
  }
}

async function onPlayed() {
  const id = parseVideoReference(props.videoID)
  if (!id)
    return
  try {
    await recordVideoPlayed(id)
  }
  catch {
    // 播放统计失败不应阻断嵌入页播放。
  }
}

watch(() => props.videoID, loadVideo, { immediate: true })
</script>

<template>
  <main class="video-embed">
    <div v-if="loading" class="video-embed__state" role="status">
      视频加载中...
    </div>

    <div v-else-if="errorMessage || !video" class="video-embed__state" role="alert">
      {{ errorMessage || '视频不存在或暂时无法播放' }}
    </div>

    <article v-else class="video-embed__content">
      <VideoPlayer :video="video" @play="onPlayed" />
      <div class="video-embed__meta">
        <span>集市视频</span>
        <h1>{{ video.title }}</h1>
      </div>
    </article>
  </main>
</template>

<style scoped>
.video-embed {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 16px;
  background: #0f172a;
  color: #e2e8f0;
}

.video-embed__state {
  min-height: 240px;
  display: grid;
  place-items: center;
  padding: 24px;
  color: #94a3b8;
}

.video-embed__content {
  width: min(100%, 960px);
}

.video-embed__content :deep(.video-player) {
  margin-bottom: 0;
}

.video-embed__meta {
  padding: 14px 2px 0;
}

.video-embed__meta span {
  display: inline-block;
  margin-bottom: 4px;
  color: #94a3b8;
  font-size: 13px;
}

.video-embed__meta h1 {
  margin: 0;
  color: #f8fafc;
  font-size: 18px;
  line-height: 1.35;
  font-weight: 650;
}

@media (max-width: 640px) {
  .video-embed {
    padding: 8px;
  }
}
</style>
