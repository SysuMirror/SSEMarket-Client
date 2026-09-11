<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'
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
</script>

<template>
  <Transition name="playerbar" :duration="350">
    <div
      v-if="current"
      class="player-bar"
    >
      <!-- 移动端：顶部长条进度（PC 由 CSS 隐藏） -->
      <div class="mobile-progress">
        <div
          class="mobile-progress-fill"
          :style="{ width: duration > 0 ? `${(progress / duration) * 100}%` : '0%' }"
        />
      </div>

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

        <!-- PC：模式 / 音量 / 队列 / 展开 -->
        <div class="extras">
          <button
            type="button"
            class="ctrl small"
            :title="modeLabel[playMode]"
            @click="cyclePlayMode()"
          >
            <Icon :icon="modeIcon[playMode]" />
          </button>
          <div class="volume">
            <Icon icon="tabler:volume-2" />
            <input
              type="range"
              min="0"
              max="100"
              :value="Math.round(volume * 100)"
              title="音量"
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
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
$accent: #ec4141;
$bar-height: 64px;

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
  gap: 16px;
  height: $bar-height;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
}

.track {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  width: 240px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  padding: 0;

  .cover {
    width: 44px;
    height: 44px;
    border-radius: 8px;
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
  gap: 6px;
  flex-shrink: 0;
}

.ctrl {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--color-text);
  cursor: pointer;
  font-size: 22px;
  transition:
    color 0.15s,
    background 0.15s;

  &:hover {
    background: rgba(236, 65, 65, 0.12);
    color: $accent;
  }

  &.play {
    width: 42px;
    height: 42px;
    background: $accent;
    color: #fff;
    font-size: 28px;

    &:hover {
      background: darken($accent, 8%);
      color: #fff;
    }
  }

  &.small {
    width: 30px;
    height: 30px;
    font-size: 18px;
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
    width: 10px;
    height: 10px;
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
  gap: 4px;
  flex-shrink: 0;
}

.volume {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-text);
  opacity: 0.75;

  input[type='range'] {
    width: 80px;
    height: 4px;
    accent-color: $accent;
    cursor: pointer;
  }
}

// 移动端：顶部长条进度（PC 隐藏，media query 中显示）
.mobile-progress {
  display: none;
  height: 3px;
  background: var(--color-border);

  .mobile-progress-fill {
    height: 100%;
    background: $accent;
  }
}

@media screen and (max-width: 768px) {
  .player-bar {
    bottom: var(--layout-bottom-nav-h, 80px); // BottomNavbar 高度
  }

  .mobile-progress {
    display: block;
  }

  .bar-inner {
    gap: 8px;
    padding: 0 12px;
  }

  .track {
    flex: 1;
    width: auto;
  }

  .progress-wrap,
  .extras {
    display: none;
  }

  .ctrl.play {
    width: 38px;
    height: 38px;
    font-size: 26px;
  }
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
</style>
