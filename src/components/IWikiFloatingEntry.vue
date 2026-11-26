<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { trackEvia } from '@/analytics/evia'
const entry = ref<HTMLElement | null>(null)
const position = ref<{ x: number; y: number } | null>(null)
const dragging = ref(false)
const style = computed(() => position.value ? { left: `${position.value.x}px`, top: `${position.value.y}px`, right: 'auto', bottom: 'auto' } : {})
const storageKey = 'iwiki-floating-position-v1'
const dismissedKey = 'iwiki-floating-dismissed-until-v1'
const dismissedForMs = 24 * 60 * 60 * 1000
function dismissedRecently(): boolean {
  try {
    const until = Number(localStorage.getItem(dismissedKey))
    return Number.isFinite(until) && until > Date.now()
  } catch { return false }
}
// setup 阶段就读取，避免先渲染一帧再消失的闪烁
const hidden = ref(dismissedRecently())
function dismiss() {
  hidden.value = true
  trackEvia('iwiki_entry_interacted', { action: 'dismissed' })
  try { localStorage.setItem(dismissedKey, String(Date.now() + dismissedForMs)) } catch { /* Storage may be disabled. */ }
}
let gesture: { id: number; x: number; y: number; left: number; top: number } | null = null
let suppressClick = false
let clickTimer: ReturnType<typeof setTimeout> | undefined
function bounds() {
  const rect = entry.value!.getBoundingClientRect()
  const nav = window.innerWidth <= 768 ? document.querySelector('.bottom-nav')?.getBoundingClientRect() : null
  const rootStyle = getComputedStyle(document.documentElement)
  const bottom = window.innerWidth <= 768 ? (nav?.height || parseFloat(rootStyle.getPropertyValue('--layout-bottom-nav-h')) || 52) : (parseFloat(rootStyle.getPropertyValue('--music-bar-h')) || 0)
  return { maxX: Math.max(12, window.innerWidth - rect.width - 12), maxY: Math.max(12, window.innerHeight - bottom - rect.height - 14) }
}
function clamp(x: number, y: number) {
  const b = bounds()
  return { x: Math.max(12, Math.min(x, b.maxX)), y: Math.max(12, Math.min(y, b.maxY)) }
}
function save() {
  if (!position.value) return
  const b = bounds()
  try { localStorage.setItem(storageKey, JSON.stringify({ side: position.value.x < window.innerWidth / 2 ? 'left' : 'right', y: position.value.y / Math.max(1, b.maxY) })) } catch { /* Storage may be disabled. */ }
}
function restore() {
  if (!entry.value) return
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return
    const saved = JSON.parse(raw)
    if (!['left', 'right'].includes(saved.side) || !Number.isFinite(saved.y)) return
    const b = bounds()
    position.value = clamp(saved.side === 'left' ? 12 : b.maxX, saved.y * b.maxY)
  } catch { /* Keep default position. */ }
}
function start(event: PointerEvent) {
  if (!event.isPrimary || gesture || (event.pointerType === 'mouse' && event.button !== 0)) return
  const rect = entry.value!.getBoundingClientRect()
  suppressClick = false
  clearTimeout(clickTimer)
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
  // 不用 setPointerCapture：捕获期间浏览器会把 click 派发给捕获元素（root）而非链接，
  // 静止点击将无法导航。改为 window 级监听跟随拖动，click 事件保持派发给 <a>。
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', finish)
}
function move(event: PointerEvent) {
  if (!gesture || gesture.id !== event.pointerId) return
  const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y
  if (!dragging.value && Math.hypot(dx, dy) < 8) return
  dragging.value = true
  suppressClick = true
  position.value = clamp(gesture.left + dx, gesture.top + dy)
}
function finish(event: PointerEvent) {
  if (!gesture || gesture.id !== event.pointerId) return
  const moved = dragging.value
  gesture = null
  dragging.value = false
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', finish)
  window.removeEventListener('pointercancel', finish)
  if (moved && position.value) {
    const b = bounds()
    position.value = clamp(position.value.x < (b.maxX + 12) / 2 ? 12 : b.maxX, position.value.y)
    save()
    clickTimer = setTimeout(() => { suppressClick = false }, 500)
  }
}
function click(event: MouseEvent) {
  if (suppressClick && event.detail !== 0) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  trackEvia('iwiki_entry_interacted', { action: 'clicked' })
}
function resized() {
  if (position.value) restore()
}
onMounted(() => { restore(); window.addEventListener('resize', resized) })
onBeforeUnmount(() => {
  clearTimeout(clickTimer)
  window.removeEventListener('resize', resized)
  window.removeEventListener('pointermove', move)
  window.removeEventListener('pointerup', finish)
  window.removeEventListener('pointercancel', finish)
})
</script>

<template>
  <div
    v-if="!hidden"
    ref="entry"
    class="iwiki-floating-entry"
    :class="{ 'is-dragging': dragging }"
    :style="style"
    @pointerdown="start"
  >
    <a
      class="iwiki-floating-entry__link"
      href="https://ssemarket.cn/iwiki/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="打开 iWiki 校园知识库（新标签页）"
      title="打开 iWiki 校园知识库"
      @click="click"
      @dragstart.prevent
    >
      <span class="iwiki-floating-entry__logo" aria-hidden="true">
        <img :src="'/iwiki/iwiki-logo.png'" alt="" width="28" height="28">
      </span>
      <span class="iwiki-floating-entry__copy">
        <strong>iWiki</strong>
        <span class="iwiki-floating-entry__subtitle">校园知识库</span>
      </span>
      <svg class="iwiki-floating-entry__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M7 17 17 7M7 7h10v10" />
      </svg>
    </a>
    <button
      type="button"
      class="iwiki-floating-entry__close"
      aria-label="隐藏 iWiki 入口"
      title="隐藏"
      @pointerdown.stop
      @click.stop="dismiss"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.iwiki-floating-entry {
  position: fixed;
  touch-action: none;
  user-select: none;
  cursor: grab;
  right: max(24px, env(safe-area-inset-right, 0px));
  bottom: calc(var(--music-bar-h, 0px) + 24px + env(safe-area-inset-bottom, 0px));
  z-index: 900;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 8px 14px 8px 10px;
  box-sizing: border-box;
  border: 1px solid var(--color-border-strong, rgba(71, 85, 105, 0.2));
  border-radius: 30px;
  background: var(--color-ball-bg, #fff);
  color: var(--color-ball-text, #2c3d56);
  box-shadow: 0 4px 18px rgba(44, 61, 86, 0.14);
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform 160ms ease, box-shadow 160ms ease;
}

.iwiki-floating-entry:hover {
  box-shadow: 0 6px 22px rgba(44, 61, 86, 0.2);
}

.iwiki-floating-entry__link {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: inherit;
  text-decoration: none;
}

.iwiki-floating-entry__close {
  position: absolute;
  top: -7px;
  right: -7px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 2px solid var(--color-ball-bg, #fff);
  border-radius: 50%;
  background: var(--color-text-muted, #94a3b8);
  color: #fff;
  cursor: pointer;
  box-sizing: border-box;
  box-shadow: 0 1px 4px rgba(44, 61, 86, 0.3);
  -webkit-tap-highlight-color: transparent;
}

.iwiki-floating-entry__close:hover {
  background: var(--color-text-secondary, #475569);
}

.iwiki-floating-entry__close:focus-visible {
  outline: 3px solid #3b82f6;
  outline-offset: 2px;
}

.iwiki-floating-entry.is-dragging {
  cursor: grabbing;
  transition: none;
}

.iwiki-floating-entry:focus-visible {
  outline: 3px solid #3b82f6;
  outline-offset: 4px;
}

.iwiki-floating-entry__logo {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
}

.iwiki-floating-entry__logo img {
  display: block;
  object-fit: contain;
}

.iwiki-floating-entry__copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.2;
}

.iwiki-floating-entry__copy strong {
  font-size: 14px;
  font-weight: 650;
  letter-spacing: -0.2px;
}

.iwiki-floating-entry__subtitle {
  color: var(--color-text-secondary, #475569);
  font-size: 10px;
}

.iwiki-floating-entry__arrow {
  margin-left: 2px;
  opacity: 0.55;
}

@media (max-width: 768px) {
  .iwiki-floating-entry {
    right: max(12px, env(safe-area-inset-right, 0px));
    bottom: calc(var(--layout-bottom-nav-h, calc(52px + env(safe-area-inset-bottom, 0px))) + 14px);
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    width: 56px;
    height: 56px;
    min-height: 56px;
    padding: 5px;
    border-radius: 50%;
  }

  .iwiki-floating-entry__link {
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    width: 100%;
    height: 100%;
  }

  .iwiki-floating-entry__close {
    top: -5px;
    right: -5px;
    width: 18px;
    height: 18px;
  }

  .iwiki-floating-entry__logo {
    width: 24px;
    height: 24px;
  }

  .iwiki-floating-entry__logo img {
    width: 24px;
    height: 24px;
  }

  .iwiki-floating-entry__copy strong {
    font-size: 10px;
  }

  .iwiki-floating-entry__subtitle,
  .iwiki-floating-entry__arrow {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .iwiki-floating-entry {
    transition: none;
  }

  .iwiki-floating-entry:hover {
    transform: none;
  }
}
</style>
