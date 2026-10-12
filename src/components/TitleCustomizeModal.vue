<script setup lang="ts">
import type { Ref } from 'vue'
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue'
import { setCustomTitle } from '@/api/info/updateInfo'
import { showMsg } from './MessageBox'

const emit = defineEmits<{ saved: [title: string] }>()

const MAX_LEN = 12
const title = ref('')
const submitting = ref(false)
const isPC = inject('isPC', ref(false)) as Ref<boolean>

const trimmed = computed(() => title.value.trim())
const len = computed(() => [...trimmed.value].length)

// 强制弹窗:拦截 Esc 等按键冒泡,仅提供「确定称号」一个出口
function onKeydown(e: KeyboardEvent) {
  e.stopPropagation()
}

async function submit() {
  if (submitting.value)
    return
  const t = trimmed.value
  if (!t || [...t].length > MAX_LEN) {
    showMsg(`称号需为 1~${MAX_LEN} 个字符`)
    return
  }
  submitting.value = true
  try {
    const res = await setCustomTitle(t)
    if (res?.code === 200) {
      emit('saved', t)
    }
    else {
      showMsg(res?.msg || '保存失败，请重试')
    }
  }
  catch {
    showMsg('保存失败，请重试')
  }
  finally {
    submitting.value = false
  }
}

// ---- 背景粒子:站点藏青色系尘埃,缓速上漂 ----
const canvasRef = ref<HTMLCanvasElement | null>(null)
const reducedMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

let rafId = 0
let cleanupResize: (() => void) | null = null

function startParticles() {
  const canvas = canvasRef.value
  if (!canvas)
    return
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  let w = 0
  let h = 0
  const resize = () => {
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  window.addEventListener('resize', resize)
  cleanupResize = () => window.removeEventListener('resize', resize)

  // 主色读站点 --accent(亮 #2c3d56 / 暗 #5989b8),粒子单色系
  const accentStr = getComputedStyle(document.body).getPropertyValue('--accent').trim()
  let ar = 44
  let ag = 61
  let ab = 86
  if (/^#[0-9a-fA-F]{6}$/.test(accentStr)) {
    ar = Number.parseInt(accentStr.slice(1, 3), 16)
    ag = Number.parseInt(accentStr.slice(3, 5), 16)
    ab = Number.parseInt(accentStr.slice(5, 7), 16)
  }
  const rgbBase = [ar, ag, ab] as [number, number, number]

  const N = 44
  const parts = Array.from({ length: N }, (_, i) => ({
    x: Math.random(),
    y: Math.random(),
    r: i < 8 ? 2.2 + Math.random() * 0.8 : 0.8 + Math.random() * 1.8,
    vy: 0.14 + Math.random() * 0.34,
    amp: 6 + Math.random() * 18,
    freq: 0.3 + Math.random() * 0.6,
    phase: Math.random() * Math.PI * 2,
    aBase: i < 8 ? 0.22 + Math.random() * 0.14 : 0.12 + Math.random() * 0.22,
    tw: 0.6 + Math.random() * 1.4,
    c: rgbBase,
    glow: i < 8,
  }))

  const t0 = performance.now()
  const tick = (now: number) => {
    const t = (now - t0) / 1000
    ctx.clearRect(0, 0, w, h)
    for (const p of parts) {
      const y = ((p.y - t * p.vy * 0.06) % 1 + 1) % 1
      const px = p.x * w + Math.sin(t * p.freq + p.phase) * p.amp
      const py = y * h
      const alpha = p.aBase * (0.55 + 0.45 * Math.sin(t * p.tw + p.phase))
      const rgb = `${p.c[0]},${p.c[1]},${p.c[2]}`
      if (p.glow) {
        // 亮尘:外圈低透明光晕 + 内核
        ctx.beginPath()
        ctx.fillStyle = `rgba(${rgb},${(alpha * 0.22).toFixed(3)})`
        ctx.arc(px, py, p.r * 2.6, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.beginPath()
      ctx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`
      ctx.arc(px, py, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown, true)
  if (!reducedMotion)
    startParticles()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true)
  if (rafId)
    cancelAnimationFrame(rafId)
  if (cleanupResize)
    cleanupResize()
})
</script>

<template>
  <Teleport to="body">
    <div class="title-modal-mask">
      <canvas
        v-if="!reducedMotion"
        ref="canvasRef"
        class="title-modal-particles"
        aria-hidden="true"
      />
      <div
        class="title-modal-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="title-modal-heading"
      >
        <span class="title-modal-badge" aria-hidden="true">Lv8</span>
        <h2 id="title-modal-heading" class="title-modal-head">
          恭喜达成最高等级
        </h2>
        <p class="title-modal-meta">
          经验值已满 5000。取一个专属称号，它将代替用户名展示在你昵称上方。
        </p>
        <label class="title-modal-field">
          <span class="title-modal-field-label">称号</span>
          <input
            v-model="title"
            class="title-modal-input"
            type="text"
            maxlength="12"
            placeholder="1~12 个字符"
            autocomplete="off"
            :autofocus="isPC"
            @keydown.enter="submit"
          >
        </label>
        <div class="title-modal-count">
          {{ len }}/{{ MAX_LEN }}
        </div>
        <button
          type="button"
          class="title-modal-btn"
          :disabled="submitting || len === 0"
          @click="submit"
        >
          {{ submitting ? '保存中…' : '确定称号' }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.title-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: title-mask-in 0.2s ease both;
}

@keyframes title-mask-in {
  from {
    opacity: 0;
  }
}

.title-modal-particles {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.title-modal-box {
  position: relative;
  width: 100%;
  max-width: 400px;
  box-sizing: border-box;
  padding: 24px;
  border-radius: var(--radius-lg);
  background: var(--color-card);
  color: var(--color-text);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  animation: title-box-in 0.24s ease-out both;
}

@keyframes title-box-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.97);
  }
}

/* Lv8 徽章:站点主色实底小牌,与主按钮同源 */
.title-modal-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 8px;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.title-modal-head {
  font-size: 17px;
  font-weight: 700;
  margin: 14px 0 6px;
  color: var(--color-text);
}

.title-modal-meta {
  font-size: 13px;
  line-height: 1.7;
  margin: 0 0 18px;
  color: var(--color-text-secondary);
}

.title-modal-field {
  display: block;
}

.title-modal-field-label {
  display: block;
  margin-bottom: 5px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.title-modal-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  color: var(--color-text);
  background: var(--color-card);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  outline: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.title-modal-input::placeholder {
  color: var(--color-text-muted);
}

.title-modal-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.title-modal-count {
  text-align: right;
  font-size: 11px;
  color: var(--color-text-muted);
  margin: 6px 2px 14px;
}

.title-modal-btn {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.title-modal-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.title-modal-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .title-modal-mask,
  .title-modal-box {
    animation: none;
  }
}
</style>
