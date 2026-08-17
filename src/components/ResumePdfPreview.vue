<script setup lang="ts">
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api'
import { Icon } from '@iconify/vue'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchResumePreviewArrayBuffer, isWeChatBrowser } from '@/api/resume/previewResume'
import { usePreviewPanGesture } from '@/composables/usePreviewPanGesture'

const props = defineProps<{
  resumeID: number
}>()

const emit = defineEmits<{
  error: [message: string]
}>()

pdfjsLib.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.js`

const ZOOM_MIN = 75
const ZOOM_MAX = 200
const ZOOM_STEP = 25
const ZOOM_SLIDER_STEP = 5

const viewportRef = ref<HTMLElement | null>(null)
const panLayerRef = ref<HTMLElement | null>(null)
const isLoading = ref(true)
const isRendering = ref(false)
const errorMsg = ref('')
const pageCount = ref(0)
const zoomPercent = ref(100)
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
    const layer = panLayerRef.value
    return { width: layer?.offsetWidth ?? 0, height: layer?.offsetHeight ?? 0 }
  },
  enabled: computed(() => !isLoading.value && !errorMsg.value && pageCount.value > 0),
})

/** 滑块已填充比例，用于辅助条渐变 */
const sliderFillStyle = computed(() => {
  const pct = ((zoomPercent.value - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100
  return { '--slider-pct': `${Math.max(0, Math.min(100, pct))}%` }
})

let destroyed = false
let pdfDoc: PDFDocumentProxy | null = null
let sliderRenderTimer: ReturnType<typeof setTimeout> | null = null

function clearPages() {
  const el = panLayerRef.value
  if (el)
    el.innerHTML = ''
}

async function renderPages() {
  if (!pdfDoc || destroyed)
    return

  const layer = panLayerRef.value
  const vp = viewportRef.value
  if (!layer || !vp) {
    errorMsg.value = '预览容器不可用'
    return
  }

  isRendering.value = true
  clearPages()

  try {
    const cssWidth = vp.clientWidth > 0 ? vp.clientWidth - 24 : 320
    const dpr = Math.min(window.devicePixelRatio || 1, inWeChat ? 1.5 : 2)
    const zoomFactor = zoomPercent.value / 100

    for (let num = 1; num <= pdfDoc.numPages; num++) {
      if (destroyed)
        return
      const page = await pdfDoc.getPage(num)
      const baseViewport = page.getViewport({ scale: 1 })
      const scale = (cssWidth / baseViewport.width) * dpr * zoomFactor
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      canvas.className = 'resume-pdf-preview__page'
      canvas.draggable = false
      const ctx = canvas.getContext('2d')
      if (!ctx)
        continue

      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${viewport.width / dpr}px`
      canvas.style.height = `${viewport.height / dpr}px`

      await page.render({ canvasContext: ctx, viewport }).promise
      layer.appendChild(canvas)
    }

    await nextTick()
    resetPan()
    if (panMode.value)
      clampPan()
  }
  catch (e) {
    console.error('PDF render pages error:', e)
    errorMsg.value = '渲染失败，请重试'
    emit('error', errorMsg.value)
  }
  finally {
    if (!destroyed)
      isRendering.value = false
  }
}

async function loadPdf() {
  isLoading.value = true
  errorMsg.value = ''
  clearPages()
  zoomPercent.value = 100
  resetPan()

  if (pdfDoc) {
    pdfDoc.destroy()
    pdfDoc = null
  }

  try {
    const buffer = await fetchResumePreviewArrayBuffer(props.resumeID)
    if (!buffer || destroyed) {
      errorMsg.value = '预览加载失败'
      emit('error', errorMsg.value)
      return
    }

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useSystemFonts: true,
      disableAutoFetch: true,
      disableStream: true,
    })
    pdfDoc = await loadingTask.promise
    if (destroyed)
      return

    pageCount.value = pdfDoc.numPages
    await nextTick()
    await renderPages()

    if (pdfDoc.numPages === 0) {
      errorMsg.value = 'PDF 无有效页面'
      emit('error', errorMsg.value)
    }
  }
  catch (e) {
    console.error('PDF preview error:', e)
    errorMsg.value = inWeChat
      ? '微信内预览失败，请点「下载」，或在系统浏览器中打开本站'
      : '预览加载失败，请稍后重试或下载查看'
    emit('error', errorMsg.value)
  }
  finally {
    if (!destroyed)
      isLoading.value = false
  }
}

function zoomIn() {
  if (zoomPercent.value >= ZOOM_MAX || isRendering.value || isLoading.value)
    return
  zoomPercent.value = Math.min(ZOOM_MAX, zoomPercent.value + ZOOM_STEP)
  renderPages()
}

function zoomOut() {
  if (zoomPercent.value <= ZOOM_MIN || isRendering.value || isLoading.value)
    return
  zoomPercent.value = Math.max(ZOOM_MIN, zoomPercent.value - ZOOM_STEP)
  renderPages()
}

function resetZoom() {
  if (zoomPercent.value === 100 || isRendering.value || isLoading.value)
    return
  zoomPercent.value = 100
  renderPages()
}

const canZoomIn = () => zoomPercent.value < ZOOM_MAX && !isRendering.value && !isLoading.value
const canZoomOut = () => zoomPercent.value > ZOOM_MIN && !isRendering.value && !isLoading.value

function onZoomSliderInput(e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  if (Number.isNaN(val) || val === zoomPercent.value)
    return
  zoomPercent.value = val
  if (sliderRenderTimer)
    clearTimeout(sliderRenderTimer)
  sliderRenderTimer = setTimeout(() => {
    sliderRenderTimer = null
    if (!isRendering.value && !isLoading.value)
      renderPages()
  }, 200)
}

function onZoomSliderChange() {
  if (sliderRenderTimer) {
    clearTimeout(sliderRenderTimer)
    sliderRenderTimer = null
  }
  if (!isRendering.value && !isLoading.value)
    renderPages()
}

onMounted(loadPdf)
onBeforeUnmount(() => {
  destroyed = true
  if (sliderRenderTimer) {
    clearTimeout(sliderRenderTimer)
    sliderRenderTimer = null
  }
  clearPages()
  if (pdfDoc) {
    pdfDoc.destroy()
    pdfDoc = null
  }
})

defineExpose({ retry: loadPdf })
</script>

<template>
  <div class="resume-pdf-preview">
    <p v-if="inWeChat && !errorMsg && !isLoading" class="resume-pdf-preview__tip">
      <Icon icon="tabler:info-circle" width="16" height="16" />
      微信内为页面内渲染，不会自动下载
    </p>

    <div
      v-if="pageCount > 0 && !errorMsg && !isLoading"
      class="resume-pdf-preview__toolbar"
      role="toolbar"
      aria-label="预览缩放"
    >
      <div class="resume-pdf-preview__zoom-row">
        <button
          type="button"
          class="resume-pdf-preview__tool-btn"
          aria-label="缩小"
          :disabled="!canZoomOut()"
          @click="zoomOut"
        >
          <Icon icon="tabler:zoom-out" width="18" height="18" />
        </button>
        <div class="resume-pdf-preview__slider-wrap">
          <input
            type="range"
            class="resume-pdf-preview__slider"
            :min="ZOOM_MIN"
            :max="ZOOM_MAX"
            :step="ZOOM_SLIDER_STEP"
            :value="zoomPercent"
            :disabled="isRendering || isLoading"
            :style="sliderFillStyle"
            aria-label="缩放比例"
            :aria-valuenow="zoomPercent"
            @input="onZoomSliderInput"
            @change="onZoomSliderChange"
          >
          <div class="resume-pdf-preview__slider-labels">
            <span>{{ ZOOM_MIN }}%</span>
            <span>{{ ZOOM_MAX }}%</span>
          </div>
        </div>
        <button
          type="button"
          class="resume-pdf-preview__tool-btn"
          aria-label="放大"
          :disabled="!canZoomIn()"
          @click="zoomIn"
        >
          <Icon icon="tabler:zoom-in" width="18" height="18" />
        </button>
      </div>
      <div class="resume-pdf-preview__toolbar-foot">
        <span class="resume-pdf-preview__zoom">{{ zoomPercent }}%</span>
        <button
          type="button"
          class="resume-pdf-preview__tool-btn resume-pdf-preview__tool-btn--text"
          :disabled="zoomPercent === 100 || isRendering"
          @click="resetZoom"
        >
          适应宽度
        </button>
        <span v-if="isRendering" class="resume-pdf-preview__rendering">渲染中…</span>
      </div>
    </div>

    <div v-if="isLoading" class="resume-pdf-preview__state">
      正在加载预览…
    </div>
    <div v-else-if="errorMsg" class="resume-pdf-preview__state">
      {{ errorMsg }}
      <button type="button" class="resume-pdf-preview__retry" @click="loadPdf">
        重试
      </button>
    </div>

    <div
      v-show="!isLoading && !errorMsg"
      ref="viewportRef"
      class="resume-pdf-preview__viewport"
      :class="{
        'resume-pdf-preview__viewport--pan': panMode,
        'resume-pdf-preview__viewport--scroll': !panMode,
        'resume-pdf-preview__viewport--dragging': isDragging && panMode,
      }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div
        ref="panLayerRef"
        class="resume-pdf-preview__pan"
        :class="{ 'resume-pdf-preview__pan--active': panMode }"
        :style="panStyle"
      />
    </div>

    <p v-if="pageCount > 0 && !isLoading && !errorMsg" class="resume-pdf-preview__pages-info">
      <template v-if="panMode">
        共 {{ pageCount }} 页 · 放大后可拖动画布；未放大时页面可正常上下滑动
      </template>
      <template v-else>
        共 {{ pageCount }} 页 · 预览区内滑动翻阅，页面可正常上下滑动
      </template>
    </p>
  </div>
</template>

<style scoped lang="scss">
.resume-pdf-preview {
  width: 100%;
  padding: 10px 12px 14px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI', 'PingFang SC', sans-serif;
}

.resume-pdf-preview__tip {
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

.resume-pdf-preview__toolbar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
  padding: 8px 10px;
  background: var(--chat-bg, #f5f5f5);
  border-radius: 8px;
}

.resume-pdf-preview__zoom-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.resume-pdf-preview__slider-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.resume-pdf-preview__slider {
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

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

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

  &::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: rgba(0, 0, 0, 0.12);
  }
}

.resume-pdf-preview__slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  line-height: 1;
  color: var(--chat-text-secondary, #8a8a8a);
  user-select: none;
}

.resume-pdf-preview__toolbar-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 2px;
}

.resume-pdf-preview__tool-btn {
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

.resume-pdf-preview__zoom {
  min-width: 44px;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--chat-text, #242424);
}

.resume-pdf-preview__rendering {
  margin-left: auto;
  font-size: 12px;
  color: var(--chat-text-secondary, #616161);
}

.resume-pdf-preview__state {
  padding: 40px 16px;
  text-align: center;
  color: var(--chat-text-secondary, #616161);
  font-size: 14px;
}

.resume-pdf-preview__retry {
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

.resume-pdf-preview__viewport {
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

.resume-pdf-preview__pan {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: max-content;
  min-width: 100%;
  padding: 12px;
  box-sizing: border-box;

  &--active {
    position: absolute;
    top: 0;
    left: 0;
    will-change: transform;
  }
}

.resume-pdf-preview__pan :deep(.resume-pdf-preview__page) {
  display: block;
  flex-shrink: 0;
  max-width: none;
  pointer-events: none;
  box-shadow:
    0 1.6px 3.6px rgba(0, 0, 0, 0.13),
    0 0.3px 0.9px rgba(0, 0, 0, 0.11);
  border-radius: 2px;
  background: #fff;
}

.resume-pdf-preview__pages-info {
  margin: 8px 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--chat-text-secondary, #616161);
}

:global(body.dark-mode) .resume-pdf-preview__viewport {
  background: #1f1f1f;
}

:global(body.dark-mode) .resume-pdf-preview__toolbar {
  background: rgba(255, 255, 255, 0.06);
}
</style>
