<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
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
  closePlayer,
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

/* ---------------- 移动端悬浮球（可点击 / 可拖动 / 可关闭 / 可隐藏） ---------------- */

const isMobile = ref(typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches)
const BALL_SIZE = 56
const EDGE = 10
const POS_KEY = 'music-ball-pos'

const ballPos = ref<{ x: number, y: number } | null>(null)
const ballHidden = ref(false)
const ballDragging = ref(false)
let ballDrag: { startX: number, startY: number, origX: number, origY: number, moved: boolean } | null = null

function ballDefaultPos() {
  return { x: window.innerWidth - EDGE - BALL_SIZE, y: Math.round(window.innerHeight * 0.62) }
}

function clampBallPos(pos: { x: number, y: number }) {
  const minX = EDGE
  const maxX = window.innerWidth - EDGE - BALL_SIZE
  const minY = 70
  const maxY = window.innerHeight - 65 - 12 - BALL_SIZE
  return {
    x: Math.min(Math.max(pos.x, minX), Math.max(minX, maxX)),
    y: Math.min(Math.max(pos.y, minY), Math.max(minY, maxY)),
  }
}

function restoreBallPos() {
  try {
    const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null')
    if (saved && Number.isFinite(saved.xPct) && Number.isFinite(saved.yPct))
      ballPos.value = clampBallPos({ x: saved.xPct * window.innerWidth, y: saved.yPct * window.innerHeight })
  }
  catch { /* ignore */ }
  if (!ballPos.value)
    ballPos.value = ballDefaultPos()
}

function persistBallPos() {
  if (!ballPos.value)
    return
  try {
    localStorage.setItem(POS_KEY, JSON.stringify({
      xPct: ballPos.value.x / window.innerWidth,
      yPct: ballPos.value.y / window.innerHeight,
    }))
  }
  catch { /* ignore */ }
}

function onBallMove(e: PointerEvent) {
  if (!ballDrag)
    return
  const dx = e.clientX - ballDrag.startX
  const dy = e.clientY - ballDrag.startY
  if (!ballDrag.moved && Math.abs(dx) + Math.abs(dy) > 6)
    ballDrag.moved = true
  if (ballDrag.moved)
    ballPos.value = clampBallPos({ x: ballDrag.origX + dx, y: ballDrag.origY + dy })
}

function onBallUp() {
  if (!ballDrag)
    return
  const wasMoved = ballDrag.moved
  ballDrag = null
  ballDragging.value = false
  window.removeEventListener('pointermove', onBallMove)
  window.removeEventListener('pointerup', onBallUp)
  if (wasMoved && ballPos.value) {
    // 贴边吸附
    const center = ballPos.value.x + BALL_SIZE / 2
    const targetX = center < window.innerWidth / 2 ? EDGE : window.innerWidth - EDGE - BALL_SIZE
    ballPos.value = clampBallPos({ x: targetX, y: ballPos.value.y })
    persistBallPos()
  }
  else if (!wasMoved) {
    openNowPlaying()
  }
}

function onBallDown(e: PointerEvent) {
  if (!ballPos.value)
    return
  ballDrag = { startX: e.clientX, startY: e.clientY, origX: ballPos.value.x, origY: ballPos.value.y, moved: false }
  ballDragging.value = true
  window.addEventListener('pointermove', onBallMove)
  window.addEventListener('pointerup', onBallUp)
}

const ballStyle = computed(() => {
  const pos = ballPos.value
  if (!pos)
    return {}
  return { left: `${pos.x}px`, top: `${pos.y}px` }
})

const ringCirc = 2 * Math.PI * 26.5
const ringOffset = computed(() => {
  const ratio = duration.value > 0 ? Math.min(Math.max(progress.value / duration.value, 0), 1) : 0
  return ringCirc * (1 - ratio)
})

function onBallResize() {
  if (ballPos.value)
    ballPos.value = clampBallPos(ballPos.value)
}

onMounted(() => {
  window.matchMedia('(max-width: 768px)').addEventListener('change', (e) => {
    isMobile.value = e.matches
  })
  window.addEventListener('resize', onBallResize)
  restoreBallPos()
})
</script>

<template>
  <!-- 桌面：全宽播放栏（侧边栏展开时通过 body.pwa-sidebar-open 让位） -->
  <Transition name="playerbar" :duration="350">
    <div
      v-if="current && !isMobile"
      class="player-bar"
    >
      <div class="bar-inner">
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
      </div>
    </div>
  </Transition>

  <!-- 移动端：可拖动悬浮球（点按展开播放页 / 拖动换位贴边 / X 关闭 / — 缩为圆点） -->
  <Transition name="playerbar" :duration="300">
    <div
      v-if="current && isMobile && !ballHidden"
      class="music-ball"
      :class="{ 'music-ball--dragging': ballDragging }"
      :style="ballStyle"
      @pointerdown="onBallDown"
    >
      <svg class="ball-ring" viewBox="0 0 56 56">
        <circle class="ball-ring__track" cx="28" cy="28" r="26.5" />
        <circle
          class="ball-ring__fill"
          cx="28"
          cy="28"
          r="26.5"
          :stroke-dasharray="ringCirc"
          :stroke-dashoffset="ringOffset"
        />
      </svg>
      <img
        class="ball-cover"
        :src="musicCoverOrDefault(current)"
        alt="播放悬浮球"
        @error="current && (current.hasCover = false)"
      >
      <button
        type="button"
        class="ball-act ball-act--close"
        aria-label="关闭播放器"
        @pointerdown.stop
        @click.stop="closePlayer()"
      >
        <Icon icon="tabler:x" width="11" height="11" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="ball-act ball-act--hide"
        aria-label="隐藏悬浮球"
        @pointerdown.stop
        @click.stop="ballHidden = true"
      >
        <Icon icon="tabler:minus" width="11" height="11" aria-hidden="true" />
      </button>
    </div>
  </Transition>
  <Transition name="playerbar" :duration="300">
    <button
      v-if="current && isMobile && ballHidden"
      type="button"
      class="music-ball-dot"
      aria-label="恢复播放悬浮球"
      :style="ballStyle"
      @click.stop="ballHidden = false"
    />
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

/* —— 移动端：可拖动悬浮球 —— */
.music-ball {
  position: fixed;
  z-index: 2100;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  padding: 4px;
  box-sizing: border-box;
  cursor: grab;
  touch-action: none;
  user-select: none;
  transition:
    left 0.25s ease,
    top 0.25s ease;
  filter: drop-shadow(0 4px 12px rgba(2, 6, 23, 0.35));

  &--dragging {
    transition: none;
    cursor: grabbing;
  }

  &:active {
    cursor: grabbing;
  }
}

.ball-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);

  .ball-ring__track {
    fill: none;
    stroke: rgba(148, 163, 184, 0.35);
    stroke-width: 3;
  }

  .ball-ring__fill {
    fill: none;
    stroke: $accent;
    stroke-width: 3;
    stroke-linecap: round;
  }
}

.ball-cover {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  pointer-events: none;
  background: var(--color-nav-bg);
}

.ball-act {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1.5px solid rgba(255, 255, 255, 0.85);
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.72);
  color: #fff;
  cursor: pointer;

  &--close {
    top: -3px;
    right: -3px;
  }

  &--hide {
    bottom: -3px;
    right: -3px;
  }

  &:active {
    transform: scale(0.9);
  }
}

.music-ball-dot {
  position: fixed;
  z-index: 2100;
  width: 14px;
  height: 14px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(236, 65, 65, 0.65);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(2, 6, 23, 0.3);
}
</style>
