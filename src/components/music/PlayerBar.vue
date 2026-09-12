<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import {
  formatDuration,
  musicCoverOrDefault,
  useMusicStore,
} from '@/store/musicStore'

const {
  current,
  isPlaying,
  progress,
  duration,
  volume,
  playMode,
  showPlaylist,
  restoreOnce,
  togglePlay,
  nextTrack,
  prevTrack,
  seekTo,
  setVolume,
  cyclePlayMode,
  openNowPlaying,
} = useMusicStore()

const modeIcon = { list: 'tabler:repeat', one: 'tabler:repeat-once', shuffle: 'tabler:shuffle' } as const
const modeLabel = { list: '列表循环', one: '单曲循环', shuffle: '随机播放' } as const

// 拖动进度条：pointer 按下即 seek，拖动过程持续 seek
const barEl = useTemplateRef<HTMLElement>('barEl')
let dragging = false

function seekByEvent(e: PointerEvent) {
  if (!barEl.value || duration.value <= 0)
    return
  const rect = barEl.value.getBoundingClientRect()
  const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
  seekTo(ratio * duration.value)
}

function onBarDown(e: PointerEvent) {
  dragging = true
  seekByEvent(e)
}

function onBarMove(e: PointerEvent) {
  if (dragging)
    seekByEvent(e)
}

function onBarUp() {
  dragging = false
}

onMounted(() => {
  restoreOnce()
  window.addEventListener('pointermove', onBarMove)
  window.addEventListener('pointerup', onBarUp)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onBarMove)
  window.removeEventListener('pointerup', onBarUp)
})

// 音量：点图标静音/恢复，滑杆 hover 展开（网易云式省空间）
const lastVolume = ref(0.8)

function toggleMute() {
  if (volume.value > 0) {
    lastVolume.value = volume.value
    setVolume(0)
  }
  else {
    setVolume(lastVolume.value || 0.8)
  }
}

function volumeIcon(): string {
  if (volume.value === 0)
    return 'tabler:volume-off'
  return volume.value < 0.5 ? 'tabler:volume-1' : 'tabler:volume-2'
}
</script>

<template>
  <Transition name="playerbar" :duration="350">
    <div
      v-if="current"
      class="player-bar"
    >
      <div class="bar-inner">
        <!-- 封面 + 曲目信息（点封面进全屏大播放页） -->
        <button
          class="track"
          type="button"
          @click="openNowPlaying"
        >
          <img
            class="cover"
            :src="musicCoverOrDefault(current)"
            alt="封面"
            @error="current && (current.hasCover = false)"
          >
          <div class="info">
            <div class="title">
              {{ current.title }}
            </div>
            <div class="artist">
              {{ current.artist || '未知歌手' }}
            </div>
          </div>
        </button>

        <!-- 控制区 -->
        <div class="controls">
          <button
            type="button"
            class="ctrl"
            title="上一首"
            @click="prevTrack()"
          >
            <Icon icon="tabler:player-skip-back-filled" />
          </button>
          <button
            type="button"
            class="ctrl play"
            :title="isPlaying ? '暂停' : '播放'"
            @click="togglePlay()"
          >
            <Icon :icon="isPlaying ? 'tabler:player-pause-filled' : 'tabler:player-play-filled'" />
          </button>
          <button
            type="button"
            class="ctrl"
            title="下一首"
            @click="nextTrack()"
          >
            <Icon icon="tabler:player-skip-forward-filled" />
          </button>
        </div>

        <!-- PC：进度条 + 时间 -->
        <div class="progress-wrap">
          <span class="time">{{ formatDuration(progress) }}</span>
          <div
            ref="barEl"
            class="progress-bar"
            @pointerdown="onBarDown"
          >
            <div
              class="progress-fill"
              :style="{ width: duration > 0 ? `${(progress / duration) * 100}%` : '0%' }"
            />
            <div
              class="progress-thumb"
              :style="{ left: duration > 0 ? `${(progress / duration) * 100}%` : '0%' }"
            />
          </div>
          <span class="time">{{ formatDuration(duration) }}</span>
        </div>

        <!-- PC：模式 / 音量（hover 展开） / 队列 / 展开 -->
        <div class="extras">
          <button
            type="button"
            class="ctrl small"
            :title="modeLabel[playMode]"
            @click="cyclePlayMode()"
          >
            <Icon :icon="modeIcon[playMode]" />
          </button>
          <div class="volume" title="音量">
            <button
              type="button"
              class="volume-btn"
              :title="volume > 0 ? '静音' : '取消静音'"
              @click="toggleMute"
            >
              <Icon :icon="volumeIcon()" />
            </button>
            <input
              class="volume-slider"
              type="range"
              min="0"
              max="100"
              :value="Math.round(volume * 100)"
              aria-label="音量"
              @input="setVolume(Number(($event.target as HTMLInputElement).value) / 100)"
            >
          </div>
          <button
            type="button"
            class="ctrl small"
            title="播放队列"
            @click="showPlaylist = !showPlaylist"
          >
            <Icon icon="tabler:playlist" />
          </button>
          <button
            type="button"
            class="ctrl small"
            title="展开大播放页"
            @click="openNowPlaying()"
          >
            <Icon icon="tabler:chevron-up" />
          </button>
        </div>

        <!-- 移动端：药丸内底部发丝进度线（PC 由 CSS 隐藏） -->
        <div class="mobile-progress">
          <div
            class="mobile-progress-fill"
            :style="{ width: duration > 0 ? `${(progress / duration) * 100}%` : '0%' }"
          />
        </div>

        <!-- 移动端：药丸内的下一首按钮（PC 由 CSS 隐藏） -->
        <button
          type="button"
          class="ctrl mobile-next"
          title="下一首"
          @click="nextTrack()"
        >
          <Icon icon="tabler:player-skip-forward-filled" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss">
/* 非 scoped：PWA 桌面体验侧边栏展开时播放栏让位（侧边栏 280px，收起时移出视口） */
body.pwa-sidebar-open .player-bar {
  left: 280px;
}
</style>

<style lang="scss" scoped>
$accent: #ec4141;
$bar-height: 72px;

.player-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
  background: var(--color-nav-bg);
  border-top: 1px solid var(--color-border);
  backdrop-filter: blur(14px);
  box-shadow: 0 -4px 18px rgba(0, 0, 0, 0.14);
}

.bar-inner {
  display: flex;
  align-items: center;
  gap: 18px;
  height: $bar-height;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 18px;
}

.track {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  width: 250px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  padding: 0;

  .cover {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    object-fit: cover;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .info {
    min-width: 0;

    .title {
      color: var(--color-text);
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .artist {
      color: var(--color-text);
      opacity: 0.55;
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }
  }
}

.controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.ctrl {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--color-text);
  cursor: pointer;
  font-size: 26px;
  transition:
    color 0.15s,
    background 0.15s,
    transform 0.15s;

  &:hover {
    background: rgba(236, 65, 65, 0.12);
    color: $accent;
  }

  &:active {
    transform: scale(0.94);
  }

  &.play {
    width: 50px;
    height: 50px;
    background: $accent;
    color: #fff;
    font-size: 32px;
    box-shadow: 0 4px 14px rgba(236, 65, 65, 0.4);

    &:hover {
      background: darken($accent, 8%);
      color: #fff;
      transform: scale(1.04);
    }

    &:active {
      transform: scale(0.96);
    }
  }

  &.small {
    width: 34px;
    height: 34px;
    font-size: 20px;
  }
}

.progress-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;

  .time {
    font-size: 11px;
    color: var(--color-text);
    opacity: 0.55;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
}

.progress-bar {
  position: relative;
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--color-border);
  cursor: pointer;

  .progress-fill {
    height: 100%;
    border-radius: 2px;
    background: $accent;
  }

  .progress-thumb {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: $accent;
    transform: translate(-50%, -50%);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    opacity: 0;
    transition: opacity 0.15s;
  }

  &:hover .progress-thumb {
    opacity: 1;
  }
}

.extras {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* 音量：默认只显图标，hover 展开滑杆（网易云式省空间） */
.volume {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 6px;
  margin-right: 2px;
  color: var(--color-text);
  opacity: 0.85;

  .volume-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: none;
    border-radius: 50%;
    background: none;
    color: inherit;
    cursor: pointer;
    font-size: 20px;

    &:hover {
      background: rgba(236, 65, 65, 0.12);
      color: $accent;
    }
  }

  .volume-slider {
    width: 0;
    opacity: 0;
    height: 4px;
    accent-color: $accent;
    cursor: pointer;
    transition:
      width 0.22s ease,
      opacity 0.22s ease;
  }

  &:hover .volume-slider,
  .volume-slider:active {
    width: 96px;
    opacity: 1;
  }
}

/* 移动端元素：PC 隐藏 */
.mobile-progress {
  display: none;
}

.mobile-next {
  display: none;
}

.playerbar-enter-active,
.playerbar-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.playerbar-enter-from,
.playerbar-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* —— 移动端：悬浮迷你药丸（YouTube Music 式浮动，避开底栏与发帖 FAB） —— */
@media screen and (max-width: 768px) {
  .player-bar {
    left: 10px;
    right: 10px;
    bottom: calc(var(--layout-bottom-nav-h, 80px) + 84px);
    background: var(--color-nav-bg);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    box-shadow: 0 6px 24px rgba(2, 6, 23, 0.22);
    backdrop-filter: blur(14px);
    overflow: hidden;
  }

  .bar-inner {
    gap: 10px;
    height: 58px;
    padding: 0 12px;
    max-width: none;
  }

  .track {
    flex: 1;
    width: auto;
    gap: 10px;

    .cover {
      width: 40px;
      height: 40px;
      border-radius: 9px;
    }
  }

  .controls {
    gap: 4px;
  }

  .ctrl.play {
    width: 42px;
    height: 42px;
    font-size: 27px;
    box-shadow: 0 3px 10px rgba(236, 65, 65, 0.35);
  }

  .ctrl:not(.play) {
    display: none;
  }

  /* 药丸内的下一首（专用于移动端显示） */
  .ctrl.mobile-next {
    display: inline-flex;
    width: 36px;
    height: 36px;
    font-size: 22px;
    flex-shrink: 0;
  }

  .progress-wrap,
  .extras {
    display: none;
  }

  /* 发丝进度线：药丸底部内嵌 */
  .mobile-progress {
    display: block;
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: rgba(148, 163, 184, 0.25);

    .mobile-progress-fill {
      height: 100%;
      background: $accent;
    }
  }
}
</style>
