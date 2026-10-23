<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useSkin } from '@/composables/useSkin'

/**
 * 节日开场画面：进入站点展示 3 秒，可点击右上角「跳过」。
 * - 只在当前皮肤启用且用户开启「开场画面」时出现；
 * - 每个浏览器会话每套皮肤只自动展示一次（会话内路由切换不重复）；
 * - 图片用 object-fit: cover，任何屏幕比例都不拉伸，文字只放在画面留白处。
 */
const { activeSkin, splashSources, splashOpen, closeSplash } = useSkin()

const SPLASH_MS = 3000
const countdown = ref(3)
const imageLoaded = ref(false)
const imageError = ref(false)
const imageEl = ref<HTMLImageElement | null>(null)
let autoTimer: ReturnType<typeof setTimeout> | undefined
let countTimer: ReturnType<typeof setInterval> | undefined

function clearTimers() {
  if (autoTimer)
    clearTimeout(autoTimer)
  if (countTimer)
    clearInterval(countTimer)
  autoTimer = undefined
  countTimer = undefined
}

function startTimers() {
  clearTimers()
  countdown.value = 3
  imageLoaded.value = false
  imageError.value = false
  countTimer = setInterval(() => {
    countdown.value = Math.max(1, countdown.value - 1)
  }, 1000)
  autoTimer = setTimeout(() => closeSplash(true), SPLASH_MS)
  // 缓存命中时 load 可能在监听器挂上之前就完成，补一次 complete 检查
  void nextTick(() => {
    if (imageEl.value?.complete)
      imageLoaded.value = true
  })
}

function skip() {
  closeSplash(true)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && splashOpen.value)
    skip()
}

watch(splashOpen, (open) => {
  if (open)
    startTimers()
  else
    clearTimers()
}, { immediate: true })

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  clearTimers()
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="skin-splash">
      <div
        v-if="splashOpen && splashSources"
        class="skin-splash"
        role="dialog"
        aria-modal="true"
        :aria-label="`${activeSkin?.name || '节日'}开场画面`"
      >
        <div class="skin-splash__media">
          <picture v-if="!imageError">
            <source :srcset="splashSources.desktop" media="(min-width: 769px)">
            <img
              ref="imageEl"
              :src="splashSources.mobile"
              :class="{ 'is-loaded': imageLoaded }"
              :alt="activeSkin?.name || '节日开场画面'"
              decoding="async"
              fetchpriority="high"
              draggable="false"
              @load="imageLoaded = true"
              @error="imageError = true"
            >
          </picture>
          <div v-else class="skin-splash__fallback" aria-hidden="true">
            <span class="skin-splash__fallback-code">&lt;/&gt;</span>
            <strong>{{ activeSkin?.name }}</strong>
            <span>{{ activeSkin?.description }}</span>
          </div>
        </div>

        <div class="skin-splash__topbar">
          <span class="skin-splash__brand">
            <span class="skin-splash__brand-dot" aria-hidden="true" />
            SSE 集市 · 10.24
          </span>
          <button type="button" class="skin-splash__skip" @click="skip">
            跳过
            <Icon icon="tabler:player-skip-forward" width="16" height="16" aria-hidden="true" />
          </button>
        </div>

        <div class="skin-splash__footer">
          <span class="skin-splash__hint">{{ countdown }} 秒后自动进入</span>
        </div>

        <div class="skin-splash__progress" aria-hidden="true">
          <span class="skin-splash__progress-bar" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.skin-splash {
  position: fixed;
  inset: 0;
  z-index: 6000;
  overflow: hidden;
  background:
    radial-gradient(90% 70% at 50% 0%, #eef5ff 0%, #dceaff 55%, #cfe2ff 100%);
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}

.skin-splash__media,
.skin-splash__media picture,
.skin-splash__media img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.skin-splash__media img {
  display: block;
  object-fit: cover;
  object-position: center 38%;
  opacity: 0;
  transform: scale(1.015);
  transition: opacity 420ms ease, transform 900ms ease;
  user-select: none;

  &.is-loaded {
    opacity: 1;
    transform: scale(1);
  }
}

.skin-splash__fallback {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #31558f;
  text-align: center;
  padding: 24px;

  .skin-splash__fallback-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: clamp(28px, 9vw, 64px);
    font-weight: 700;
    letter-spacing: 0.08em;
    opacity: 0.4;
  }

  strong {
    font-size: clamp(20px, 6vw, 30px);
  }

  span:last-child {
    font-size: clamp(13px, 3.6vw, 16px);
    opacity: 0.72;
  }
}

/* 顶部/底部只做很轻的遮罩，保证按钮文字可读，不压住人物 */
.skin-splash__topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding:
    max(14px, env(safe-area-inset-top, 0px))
    max(14px, env(safe-area-inset-right, 0px))
    28px
    max(16px, env(safe-area-inset-left, 0px));
  background: linear-gradient(180deg, rgba(233, 243, 255, 0.72) 0%, rgba(233, 243, 255, 0) 100%);
}

.skin-splash__brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(61, 111, 214, 0.18);
  color: #2f5bb8;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.skin-splash__brand-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #3d6fd6;
  box-shadow: 0 0 0 3px rgba(61, 111, 214, 0.16);
}

.skin-splash__skip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(61, 111, 214, 0.22);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #2f5bb8;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: 0 4px 14px rgba(47, 91, 184, 0.12);
  transition: background 0.15s ease, transform 0.15s ease;

  &:hover {
    background: #fff;
  }

  &:active {
    transform: scale(0.97);
  }

  &:focus-visible {
    outline: 2px solid #3d6fd6;
    outline-offset: 2px;
  }
}

.skin-splash__footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 34px);
  z-index: 2;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.skin-splash__hint {
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.66);
  color: #47628f;
  font-size: 12px;
  letter-spacing: 0.02em;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.skin-splash__progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3;
  height: 3px;
  background: rgba(61, 111, 214, 0.12);
}

.skin-splash__progress-bar {
  display: block;
  height: 100%;
  width: 100%;
  transform-origin: left center;
  background: linear-gradient(90deg, #8ab6ff, #3d6fd6);
  animation: skin-splash-progress 3s linear forwards;
}

@keyframes skin-splash-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

.skin-splash-enter-active,
.skin-splash-leave-active {
  transition: opacity 260ms ease;
}

.skin-splash-enter-from,
.skin-splash-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .skin-splash__media img {
    /* 手机竖图：人物居中偏上，裁切时保留头与手中的牌子 */
    object-position: center 34%;
  }

  .skin-splash__footer {
    bottom: calc(env(safe-area-inset-bottom, 0px) + 26px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .skin-splash__media img {
    transform: none;
    transition: opacity 200ms ease;
  }

  .skin-splash__progress-bar {
    animation-duration: 3s;
  }
}
</style>
