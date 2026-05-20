<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { usePreviewPanGesture } from '@/composables/usePreviewPanGesture'
import { fetchResumePreviewBlob, isWeChatBrowser } from '@/api/resume/previewResume'

const props = defineProps<{
  resumeID: number
}>()

const emit = defineEmits<{
  error: [message: string]
}>()

const ZOOM_MIN = 75
const ZOOM_MAX = 200
const ZOOM_STEP = 25
const ZOOM_SLIDER_STEP = 5

const viewportRef = ref<HTMLElement | null>(null)
const isLoading = ref(true)
const errorMsg = ref('')
const imageUrl = ref('')
const zoomPercent = ref(100)
const baseWidth = ref(0)
const baseHeight = ref(0)
const inWeChat = isWeChatBrowser()

const {
  isDragging,
  panMode,
  panStyle,
  resetPan,
  clampPan,
  onPointerDown,
  onPointerMove,
  onPointerUp,
} = usePreviewPanGesture({
  zoomPercent,
  viewportRef,
  getContentSize: () => {
    const scale = zoomPercent.value / 100
    return {
      width: baseWidth.value * scale,
      height: baseHeight.value * scale,
    }
  },
  enabled: computed(() => !isLoading.value && !errorMsg.value && !!imageUrl.value),
})

const imageWrapStyle = computed(() => {
  const scale = zoomPercent.value / 100
  if (!baseWidth.value)
    return {}
  return {
    width: `${baseWidth.value * scale}px`,
    height: `${baseHeight.value * scale}px`,
  }
})

const sliderFillStyle = computed(() => {
  const pct = ((zoomPercent.value - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100
  return { '--slider-pct': `${Math.max(0, Math.min(100, pct))}%` }
})

let objectUrl: string | null = null

function revokeUrl() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
  imageUrl.value = ''
  baseWidth.value = 0
  baseHeight.value = 0
}

function onImageLoad(e: Event) {
  const img = e.target as HTMLImageElement
  const vp = viewportRef.value
  const maxW = vp && vp.clientWidth > 0 ? vp.clientWidth - 24 : 320
  const maxH = vp && vp.clientHeight > 0 ? vp.clientHeight - 24 : 480

  let w = img.naturalWidth
  let h = img.naturalHeight
  if (!w || !h)
    return

  const ratio = w / h
  if (w > maxW) {
    w = maxW
    h = w / ratio
  }
  if (h > maxH) {
    h = maxH
    w = h * ratio
  }

  baseWidth.value = w
  baseHeight.value = h
  resetPan()
  if (panMode.value)
    clampPan()
}

function applyZoom() {
  if (panMode.value)
    clampPan()
}

function zoomIn() {
  if (zoomPercent.value >= ZOOM_MAX || isLoading.value)
    return
  zoomPercent.value = Math.min(ZOOM_MAX, zoomPercent.value + ZOOM_STEP)
  applyZoom()
}

function zoomOut() {
  if (zoomPercent.value <= ZOOM_MIN || isLoading.value)
    return
  zoomPercent.value = Math.max(ZOOM_MIN, zoomPercent.value - ZOOM_STEP)
  applyZoom()
}

function resetZoom() {
  if (zoomPercent.value === 100 || isLoading.value)
    return
  zoomPercent.value = 100
  applyZoom()
}

function onZoomSliderInput(e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  if (Number.isNaN(val) || val === zoomPercent.value)
    return
  zoomPercent.value = val
  applyZoom()
}

const canZoomIn = () => zoomPercent.value < ZOOM_MAX && !isLoading.value
const canZoomOut = () => zoomPercent.value > ZOOM_MIN && !isLoading.value

async function loadImage() {
  isLoading.value = true
  errorMsg.value = ''
  zoomPercent.value = 100
  revokeUrl()
  resetPan()

  try {
    const blob = await fetchResumePreviewBlob(props.resumeID)
    if (!blob || blob.size === 0) {
      errorMsg.value = '预览加载失败'
      emit('error', errorMsg.value)
      return
    }
    objectUrl = URL.createObjectURL(blob)
    imageUrl.value = objectUrl
  }
  catch (e) {
    console.error('Image preview error:', e)
    errorMsg.value = inWeChat
      ? '微信内预览失败，请点「下载」，或在系统浏览器中打开本站'
      : '预览加载失败，请稍后重试或下载查看'
    emit('error', errorMsg.value)
  }
  finally {
    isLoading.value = false
  }
}

onMounted(loadImage)
onBeforeUnmount(() => {
  revokeUrl()
})

defineExpose({ retry: loadImage })
</script>

<template>
  <div class="resume-image-preview">
    <p v-if="inWeChat && !errorMsg && !isLoading" class="resume-image-preview__tip">
      <Icon icon="tabler:info-circle" width="16" height="16" />
      微信内为页面内展示，不会自动下载
    </p>

    <div
      v-if="imageUrl && !errorMsg && !isLoading"
      class="resume-image-preview__toolbar"
      role="toolbar"
      aria-label="图片缩放"
    >
      <div class="resume-image-preview__zoom-row">
        <button
          type="button"
          class="resume-image-preview__tool-btn"
          aria-label="缩小"
          :disabled="!canZoomOut()"
          @click="zoomOut"
        >
          <Icon icon="tabler:zoom-out" width="18" height="18" />
        </button>
        <div class="resume-image-preview__slider-wrap">
          <input
            type="range"
            class="resume-image-preview__slider"
            :min="ZOOM_MIN"
            :max="ZOOM_MAX"
            :step="ZOOM_SLIDER_STEP"
            :value="zoomPercent"
            :style="sliderFillStyle"
            aria-label="缩放比例"
            :aria-valuenow="zoomPercent"
            @input="onZoomSliderInput"
          >
          <div class="resume-image-preview__slider-labels">
            <span>{{ ZOOM_MIN }}%</span>
            <span>{{ ZOOM_MAX }}%</span>
          </div>
        </div>
        <button
          type="button"
          class="resume-image-preview__tool-btn"
          aria-label="放大"
          :disabled="!canZoomIn()"
          @click="zoomIn"
        >
          <Icon icon="tabler:zoom-in" width="18" height="18" />
        </button>
      </div>
      <div class="resume-image-preview__toolbar-foot">
        <span class="resume-image-preview__zoom">{{ zoomPercent }}%</span>
        <button
          type="button"
          class="resume-image-preview__tool-btn resume-image-preview__tool-btn--text"
          :disabled="zoomPercent === 100"
          @click="resetZoom"
        >
          适应宽度
        </button>
      </div>
    </div>

    <div v-if="isLoading" class="resume-image-preview__state">
      正在加载图片…
    </div>
    <div v-else-if="errorMsg" class="resume-image-preview__state">
      {{ errorMsg }}
      <button type="button" class="resume-image-preview__retry" @click="loadImage">
        重试
      </button>
    </div>

    <div
      v-show="imageUrl && !errorMsg && !isLoading"
      ref="viewportRef"
      class="resume-image-preview__viewport"
      :class="{
        'resume-image-preview__viewport--pan': panMode,
        'resume-image-preview__viewport--scroll': !panMode,
        'resume-image-preview__viewport--dragging': isDragging && panMode,
      }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div
        class="resume-image-preview__pan"
        :class="{ 'resume-image-preview__pan--active': panMode }"
        :style="panStyle"
      >
        <div class="resume-image-preview__wrap" :style="imageWrapStyle">
          <img
            :src="imageUrl"
            class="resume-image-preview__img"
            alt="简历图片预览"
            draggable="false"
            @load="onImageLoad"
          >
        </div>
      </div>
    </div>

    <p v-if="imageUrl && !errorMsg && !isLoading" class="resume-image-preview__hint">
      <template v-if="panMode">
        放大后可拖动画布浏览 · 工具栏可缩放
      </template>
      <template v-else>
        页面可正常上下滑动 · 放大后可拖动画布
      </template>
    </p>
  </div>
</template>

<style scoped lang="scss">
.resume-image-preview {
  width: 100%;
  padding: 10px 12px 14px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI', 'PingFang SC', sans-serif;
}

.resume-image-preview__tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 0 10px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 17px;
  color: var(--chat-text-secondary, #616161);
  background: rgba(0, 120, 212, 0.08);
  border-radius: 6px;
}

.resume-image-preview__toolbar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
  padding: 8px 10px;
  background: var(--chat-bg, #f5f5f5);
  border-radius: 8px;
}

.resume-image-preview__zoom-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.resume-image-preview__slider-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.resume-image-preview__slider {
  width: 100%;
  height: 4px;
  margin: 10px 0;
  appearance: none;
  -webkit-appearance: none;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    #0078d4 0%,
    #0078d4 var(--slider-pct, 25%),
    rgba(0, 0, 0, 0.12) var(--slider-pct, 25%),
    rgba(0, 0, 0, 0.12) 100%
  );
  cursor: pointer;
  outline: none;

  &::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid #fff;
    background: #0078d4;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    cursor: pointer;
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid #fff;
    background: #0078d4;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    cursor: pointer;
  }
}

.resume-image-preview__slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--chat-text-secondary, #8a8a8a);
}

.resume-image-preview__toolbar-foot {
  display: flex;
  align-items: center;
  gap: 8px;
}

.resume-image-preview__tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--chat-text, #242424);
  cursor: pointer;

  &:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.06);
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  &--text {
    width: auto;
    padding: 0 10px;
    margin-left: 4px;
    font-size: 13px;
    font-weight: 600;
    color: #0078d4;
  }
}

.resume-image-preview__zoom {
  min-width: 44px;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.resume-image-preview__state {
  padding: 40px 16px;
  text-align: center;
  color: var(--chat-text-secondary, #616161);
  font-size: 14px;
}

.resume-image-preview__retry {
  display: inline-flex;
  margin: 12px auto 0;
  padding: 6px 14px;
  border: 1px solid rgba(0, 0, 0, 0.14);
  border-radius: 6px;
  background: var(--chat-bg-elevated, #fff);
  color: var(--chat-text, #242424);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: var(--color-hover, rgba(0, 0, 0, 0.04));
  }
}

.resume-image-preview__viewport {
  position: relative;
  height: min(68vh, 560px);
  min-height: 220px;
  background: #edebe9;
  border-radius: 8px;

  &--scroll {
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    overscroll-behavior-y: auto;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 12px;
    box-sizing: border-box;
  }

  &--pan {
    overflow: hidden;
    touch-action: none;
    user-select: none;
    cursor: grab;
  }

  &--dragging {
    cursor: grabbing;
  }
}

.resume-image-preview__pan {
  flex-shrink: 0;

  &--active {
    position: absolute;
    top: 0;
    left: 0;
    will-change: transform;
  }
}

.resume-image-preview__wrap {
  flex-shrink: 0;
}

.resume-image-preview__img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  box-shadow: 0 1.6px 3.6px rgba(0, 0, 0, 0.13), 0 0.3px 0.9px rgba(0, 0, 0, 0.11);
  background: #fff;
  pointer-events: none;
  -webkit-user-drag: none;
}

.resume-image-preview__hint {
  margin: 8px 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--chat-text-secondary, #616161);
}

:global(body.dark-mode) .resume-image-preview__viewport {
  background: #1f1f1f;
}

:global(body.dark-mode) .resume-image-preview__toolbar {
  background: rgba(255, 255, 255, 0.06);
}
</style>
