import type { Ref } from 'vue'
import { computed, nextTick, ref, watch } from 'vue'

/** 预览区 pan 与页面滚动手势分离：未放大且内容未溢出时交给页面/容器原生滚动 */
export function usePreviewPanGesture(options: {
  zoomPercent: Ref<number>
  viewportRef: Ref<HTMLElement | null>
  getContentSize: () => { width: number, height: number }
  enabled?: Ref<boolean>
}) {
  const panX = ref(0)
  const panY = ref(0)
  const isDragging = ref(false)

  /** 仅放大后拖动画布；100% 时用容器原生滚动，手势可传递到整页 */
  const panMode = computed(() => {
    if (options.enabled?.value === false)
      return false
    return options.zoomPercent.value > 100
  })

  const panStyle = computed(() => (
    panMode.value
      ? { transform: `translate(${panX.value}px, ${panY.value}px)` }
      : {}
  ))

  let dragStart = { x: 0, y: 0, panX: 0, panY: 0 }
  let activePointerId: number | null = null

  function resetPan() {
    panX.value = 0
    panY.value = 0
  }

  function clampPan() {
    const vp = options.viewportRef.value
    if (!vp || !panMode.value)
      return

    const { width, height } = options.getContentSize()
    const vpW = vp.clientWidth
    const vpH = vp.clientHeight

    if (width <= vpW)
      panX.value = (vpW - width) / 2
    else
      panX.value = Math.max(vpW - width, Math.min(0, panX.value))

    if (height <= vpH)
      panY.value = (vpH - height) / 2
    else
      panY.value = Math.max(vpH - height, Math.min(0, panY.value))
  }

  function onPointerDown(e: PointerEvent) {
    if (!panMode.value)
      return
    if (e.button !== 0 && e.pointerType === 'mouse')
      return

    activePointerId = e.pointerId
    isDragging.value = true
    dragStart = { x: e.clientX, y: e.clientY, panX: panX.value, panY: panY.value }
    options.viewportRef.value?.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging.value || activePointerId !== e.pointerId)
      return
    panX.value = dragStart.panX + (e.clientX - dragStart.x)
    panY.value = dragStart.panY + (e.clientY - dragStart.y)
    clampPan()
    e.preventDefault()
  }

  function onPointerUp(e: PointerEvent) {
    if (activePointerId !== e.pointerId)
      return
    isDragging.value = false
    activePointerId = null
    if (options.viewportRef.value?.hasPointerCapture(e.pointerId))
      options.viewportRef.value.releasePointerCapture(e.pointerId)
  }

  watch(panMode, (mode) => {
    if (!mode)
      resetPan()
    else
      nextTick(() => clampPan())
  })

  return {
    panX,
    panY,
    isDragging,
    panMode,
    panStyle,
    resetPan,
    clampPan,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}
