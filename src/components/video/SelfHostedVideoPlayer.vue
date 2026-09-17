<script setup lang="ts">
import type ArtplayerType from 'artplayer'
import type HlsType from 'hls.js'
import type { PublicVideo } from '@/types/video'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  video: PublicVideo
}>()

const emit = defineEmits<{
  play: []
}>()

const container = ref<HTMLDivElement>()
const failed = ref(false)
let art: ArtplayerType | null = null
let hls: HlsType | null = null
let hlsFatalRetry = false
let playEmitted = false

function handlePlay() {
  if (playEmitted)
    return
  playEmitted = true
  emit('play')
}

function destroyPlayer() {
  hls?.destroy()
  hls = null
  art?.destroy()
  art = null
}

onMounted(async () => {
  if (!container.value)
    return

  try {
    const isHls = props.video.sourceType === 'hls'
    const artplayerModule = await import('artplayer')
    let hlsModule: typeof import('hls.js') | undefined
    if (isHls)
      hlsModule = await import('hls.js')
    if (!container.value)
      return

    const Artplayer = artplayerModule.default
    art = new Artplayer({
      container: container.value,
      url: props.video.sourceURL,
      poster: props.video.coverURL,
      autoplay: false,
      setting: true,
      playbackRate: true,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
    })
    art.on('video:play', handlePlay)

    if (!isHls)
      return

    const Hls = hlsModule?.default
    if (!Hls)
      return

    if (Hls.isSupported()) {
      hls = new Hls()
      const currentHls = hls
      currentHls.loadSource(props.video.sourceURL)
      currentHls.attachMedia(art.video)
      currentHls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal)
          return
        if (!hlsFatalRetry) {
          hlsFatalRetry = true
          hls?.startLoad()
          return
        }
        hls?.destroy()
        hls = null
        failed.value = true
      })
      return
    }

    art.video.src = props.video.sourceURL
  }
  catch {
    failed.value = true
  }
})

onBeforeUnmount(destroyPlayer)
</script>

<template>
  <div v-if="!failed" ref="container" class="self-hosted-player" />
  <div v-else class="player-failed" role="status">
    <p>视频加载失败</p>
  </div>
</template>

<style scoped>
.self-hosted-player {
  width: 100%;
  height: 100%;
  background: #000;
}

.player-failed {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: #e2e8f0;
  background: #0f172a;
}

.player-failed p {
  margin: 0;
  font-size: 14px;
}
</style>
