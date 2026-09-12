<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, useTemplateRef } from 'vue'
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
  showNowPlaying,
  togglePlay,
  nextTrack,
  prevTrack,
  seekTo,
  setVolume,
  cyclePlayMode,
} = useMusicStore()

const coverSrc = computed(() => musicCoverOrDefault(current.value))

const modeIcon = { list: 'tabler:repeat', one: 'tabler:repeat-once', shuffle: 'tabler:shuffle' } as const
const modeLabel = { list: '列表循环', one: '单曲循环', shuffle: '随机播放' } as const

function close() {
  showNowPlaying.value = false
}

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
</script>

<template>
  <Teleport to="body">
    <Transition name="nowplaying" :duration="380">
      <div
        v-if="showNowPlaying && current"
        class="now-playing"
        @pointermove="onBarMove"
        @pointerup="onBarUp"
      >
        <!-- 封面模糊背景 -->
        <div
          class="bg"
          :style="{ backgroundImage: `url(${coverSrc})` }"
        />
        <div class="bg-mask" />

        <button
          type="button"
          class="close"
          title="收起"
          @click="close"
        >
          <Icon icon="tabler:chevron-down" />
        </button>

        <div class="layout">
          <!-- 左：黑胶唱片 -->
          <div class="disc-area">
            <div
              class="disc"
              :class="{ spinning: isPlaying }"
            >
              <img
                class="disc-cover"
                :src="coverSrc"
                alt="封面"
                @error="current && (current.hasCover = false)"
              >
              <div class="disc-hole" />
            </div>
            <!-- 唱臂 -->
            <div
              class="tonearm"
              :class="{ on: isPlaying }"
            >
              <div class="arm-base" />
              <div class="arm" />
              <div class="arm-head" />
            </div>
          </div>

          <!-- 右：信息 + 控制 -->
          <div class="panel">
            <div class="song">
              <div class="title">
                {{ current.title }}
              </div>
              <div class="meta">
                歌手：<span>{{ current.artist || '未知歌手' }}</span>
              </div>
              <div class="meta">
                专辑：<span>{{ current.album || '未知专辑' }}</span>
              </div>
            </div>

            <div class="progress">
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

            <div class="controls">
              <button
                type="button"
                class="ctrl"
                :class="{ 'ctrl--active': playMode !== 'list' }"
                :title="modeLabel[playMode]"
                @click="cyclePlayMode()"
              >
                <Icon :icon="modeIcon[playMode]" />
              </button>
              <button
                type="button"
                class="ctrl big"
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
                class="ctrl big"
                title="下一首"
                @click="nextTrack()"
              >
                <Icon icon="tabler:player-skip-forward-filled" />
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
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
$accent: #ec4141;

.now-playing {
  position: fixed;
  inset: 0;
  z-index: 3000;
  overflow: hidden;
  background: #0d1424;
}

.bg {
  position: absolute;
  inset: -60px;
  background-size: cover;
  background-position: center;
  filter: blur(56px) brightness(0.5) saturate(1.3);
  transform: scale(1.3);
}

.bg-mask {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgba(13, 20, 36, 0.25), rgba(13, 20, 36, 0.85));
}

.close {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 2;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 26px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(255, 255, 255, 0.22);
  }
}

.layout {
  position: relative;
  z-index: 1;
  height: 100%;
  max-width: 920px;
  margin: 0 auto;
  padding: 48px 32px 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 64px;
  color: #fff;
}

/* ---------- 黑胶唱片 ---------- */
.disc-area {
  position: relative;
  width: min(340px, 70vw);
  aspect-ratio: 1;
  flex-shrink: 0;
}

.disc {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: repeating-radial-gradient(circle at center, #14161d 0px, #14161d 2px, #1e212b 3px, #14161d 4px), #14161d;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;

  &.spinning {
    animation: disc-spin 24s linear infinite;
  }
}

@keyframes disc-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.disc-cover {
  width: 66%;
  height: 66%;
  border-radius: 50%;
  object-fit: cover;
  border: 6px solid #0a0c11;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.disc-hole {
  position: absolute;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: $accent;
  box-shadow: inset 0 0 0 8px #0d1424;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    margin: auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #0a0c11;
  }
}

/* 唱臂：暂停时抬起 */
.tonearm {
  position: absolute;
  top: -6%;
  right: -9%;
  width: 36%;
  height: 46%;
  transform-origin: 84% 16%;
  transform: rotate(-26deg);
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;

  &.on {
    transform: rotate(0deg);
  }

  .arm-base {
    position: absolute;
    top: 0;
    right: 0;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: linear-gradient(145deg, #3a4051, #1c202b);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }

  .arm {
    position: absolute;
    top: 16px;
    right: 15px;
    width: 5px;
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(#c9cedb, #6c7383);
    transform: rotate(18deg);
    transform-origin: top center;
  }

  .arm-head {
    position: absolute;
    bottom: -6px;
    left: 2px;
    width: 18px;
    height: 26px;
    border-radius: 6px;
    background: linear-gradient(145deg, #3a4051, #1c202b);
    transform: rotate(18deg);
  }
}

/* ---------- 信息与控制 ---------- */
.panel {
  flex: 1;
  min-width: 0;
  max-width: 420px;
}

.song {
  margin-bottom: 36px;

  .title {
    font-size: 28px;
    font-weight: 700;
    line-height: 1.3;
    word-break: break-all;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .meta {
    margin-top: 10px;
    font-size: 14px;
    opacity: 0.65;

    span {
      opacity: 1;
      margin-left: 4px;
    }
  }
}

.progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;

  .time {
    font-size: 12px;
    opacity: 0.65;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }
}

.progress-bar {
  position: relative;
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.22);
  cursor: pointer;

  /* 扩大触摸命中区（视觉不变） */
  &::after {
    content: '';
    position: absolute;
    inset: -12px 0;
  }

  .progress-fill {
    height: 100%;
    border-radius: 2px;
    background: #fff;
  }

  .progress-thumb {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #fff;
    transform: translate(-50%, -50%);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }
}

.controls {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ctrl {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: none;
  color: #fff;
  cursor: pointer;
  font-size: 26px;
  transition:
    color 0.15s,
    transform 0.1s;

  &:hover {
    color: $accent;
  }

  &:active {
    transform: scale(0.94);
  }

  &.big {
    font-size: 34px;
  }

  &.ctrl--active {
    color: $accent;
  }

  &.play {
    width: 62px;
    height: 62px;
    background: $accent;
    font-size: 42px;

    &:hover {
      background: lighten($accent, 6%);
      color: #fff;
    }
  }
}

.volume {
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.85;

  input[type='range'] {
    width: 96px;
    height: 4px;
    accent-color: #fff;
    cursor: pointer;
  }
}

/* 移动端：上下布局，整体垂直居中；矮屏时 auto margin 退化为顶部对齐可滚动 */
@media screen and (max-width: 768px) {
  .layout {
    flex-direction: column;
    gap: 20px;
    padding: 64px 24px calc(28px + env(safe-area-inset-bottom, 0px));
    justify-content: flex-start;
    overflow-y: auto;
  }

  .disc-area {
    width: min(58vw, 250px);
    margin-top: auto;
  }

  .panel {
    max-width: none;
    width: 100%;
    margin-bottom: auto;
  }

  .song {
    margin-bottom: 24px;
  }

  .song .title {
    font-size: 20px;
    text-align: center;
  }

  .song .meta {
    text-align: center;
  }

  .progress {
    margin-bottom: 20px;
  }

  .controls {
    justify-content: center;
    gap: 18px;
  }

  .volume {
    display: none;
  }
}

.nowplaying-enter-active,
.nowplaying-leave-active {
  transition:
    transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.35s;
}

.nowplaying-enter-from,
.nowplaying-leave-to {
  transform: translateY(6%);
  opacity: 0;
}
</style>
