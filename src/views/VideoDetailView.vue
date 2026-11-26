<script setup lang="ts">
import type { PublicVideo } from '@/types/video'
import { computed, onMounted, ref } from 'vue'
import { trackEvia } from '@/analytics/evia'
import { getVideo } from '@/api/video/getVideos'
import { recordVideoPlayed } from '@/api/video/recordPlayed'
import VideoPlayer from '@/components/video/VideoPlayer.vue'

defineOptions({
  name: 'VideoDetailView',
})

const props = defineProps<{
  videoID: string
}>()

const video = ref<PublicVideo>()
const isLoading = ref(true)
const error = ref('')
let playRecorded = false

const videoID = Number(props.videoID)

const publishDate = computed(() => {
  if (!video.value?.publishedAt)
    return ''
  return new Date(video.value.publishedAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
})

async function loadVideo() {
  if (!Number.isInteger(videoID) || videoID <= 0) {
    error.value = '视频不存在'
    isLoading.value = false
    return
  }

  isLoading.value = true
  error.value = ''
  try {
    video.value = await getVideo(videoID)
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : '视频不存在'
  }
  finally {
    isLoading.value = false
  }
}

async function onPlayed() {
  if (playRecorded)
    return
  playRecorded = true
  trackEvia('video_played', {
    video_id: videoID,
    source_type: (video.value?.sourceType || 'unknown').slice(0, 32),
  })
  try {
    await recordVideoPlayed(videoID)
  }
  catch {
    playRecorded = false
  }
}

function onMilestone(percent: 25 | 50 | 75 | 100) {
  trackEvia('video_progress_milestone', {
    video_id: videoID,
    milestone: percent,
    source_type: (video.value?.sourceType || 'unknown').slice(0, 32),
  })
}

onMounted(loadVideo)
</script>

<template>
  <div class="video-detail">
    <RouterLink class="back" to="/video">
      返回视频
    </RouterLink>

    <div v-if="isLoading" class="state" aria-live="polite">
      加载中…
    </div>
    <div v-else-if="error || !video" class="state" aria-live="assertive">
      {{ error || '视频不存在' }}
    </div>
    <template v-else>
      <VideoPlayer :video="video" @play="onPlayed" @milestone="onMilestone" />
      <div class="meta">
        <h1>{{ video.title }}</h1>
        <div class="meta-row">
          <span>{{ video.sourceType === 'bilibili' ? 'B站视频' : '本站视频' }}</span>
          <span v-if="publishDate">{{ publishDate }}</span>
          <a
            v-if="video.sourceType === 'bilibili' && video.externalPageURL"
            :href="video.externalPageURL"
            target="_blank"
            rel="noopener noreferrer"
          >去B站观看</a>
        </div>
        <p v-if="video.description" class="description">
          {{ video.description }}
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.video-detail {
  max-width: 1080px;
  margin: 0 auto;
  padding: 20px 20px 44px;
}

.back {
  display: inline-block;
  margin-bottom: 14px;
  color: #0f766e;
  text-decoration: none;
}

.back:hover {
  text-decoration: underline;
}

.state {
  display: grid;
  place-items: center;
  min-height: 300px;
  color: #64748b;
  border: 1px dashed #d7dee8;
  border-radius: 8px;
}

.meta {
  margin-top: 20px;
}

.meta h1 {
  margin: 0;
  color: #0f172a;
  font-size: 24px;
  line-height: 1.3;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-top: 10px;
  color: #64748b;
  font-size: 13px;
}

.meta-row a {
  color: #0f766e;
}

.description {
  margin: 18px 0 0;
  padding-top: 16px;
  color: #334155;
  font-size: 15px;
  line-height: 1.7;
  white-space: pre-line;
  border-top: 1px solid #e2e8f0;
}

@media (max-width: 640px) {
  .video-detail {
    padding: 14px 14px 36px;
  }

  .meta h1 {
    font-size: 21px;
  }
}
</style>
