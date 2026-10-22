<script setup lang="ts">
import type { PresenceScene } from '@/api/presence/presence'
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { usePresence } from '@/composables/usePresence'

/**
 * 在线人数徽标。
 *
 * 传 scene + targetID 时显示「N 人在线 · 本页 M 人」；
 * 只传 scene="home"（默认）时只显示站点在线人数。
 * 心跳由 DefaultLayout 里的全局循环负责，本组件只切换当前场景。
 */
const props = withDefaults(
  defineProps<{
    scene?: PresenceScene
    targetID?: number
    /** 同内容人数的前缀文案，如「正在看」「正在读」「正在听」 */
    label?: string
    compact?: boolean
  }>(),
  { scene: 'home', targetID: 0, label: '', compact: false },
)

const { online, viewers, setTarget, releaseTarget } = usePresence()

/** 每个徽标实例一个 token，只有最后一个挂载的实例拥有场景切换权。 */
let badgeTokenSeq = 0
const token = ++badgeTokenSeq

const hasViewers = computed(() => props.scene !== 'home' && Number(props.targetID) > 0)
const viewersLabel = computed(() => props.label || '本页')

function applyTarget() {
  if (hasViewers.value)
    setTarget(props.scene, Number(props.targetID), token)
  else
    setTarget('home', 0, token)
}

onMounted(applyTarget)
watch(() => [props.scene, props.targetID], applyTarget)
onBeforeUnmount(() => releaseTarget(token))
</script>

<template>
  <span
    class="presence-badge"
    :class="{ 'presence-badge--compact': compact }"
    role="status"
    aria-live="polite"
    title="最近 2.5 分钟内有心跳的登录用户"
  >
    <span class="presence-badge__dot" aria-hidden="true" />
    <span class="presence-badge__online">{{ online }} 人在线</span>
    <template v-if="hasViewers">
      <span class="presence-badge__sep" aria-hidden="true">·</span>
      <span class="presence-badge__viewers">{{ viewersLabel }} {{ viewers }} 人</span>
    </template>
  </span>
</template>

<style scoped lang="scss">
.presence-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 3px 9px;
  border: 1px solid var(--chat-border);
  border-radius: var(--radius-full, 999px);
  background: var(--chat-bg-highlight);
  color: var(--chat-text-secondary);
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  user-select: none;

  &--compact {
    padding: 2px 7px;
    font-size: 11px;
  }
}

.presence-badge__dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-success, #22c55e);
  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55);
  animation: presence-pulse 2.4s ease-out infinite;
}

.presence-badge__online {
  color: var(--chat-text);
  font-weight: 600;
}

.presence-badge__sep {
  color: var(--chat-text-tips);
}

.presence-badge__viewers {
  color: var(--chat-text-secondary);
}

@keyframes presence-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55);
  }

  70% {
    box-shadow: 0 0 0 5px rgba(34, 197, 94, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .presence-badge__dot {
    animation: none;
  }
}
</style>
