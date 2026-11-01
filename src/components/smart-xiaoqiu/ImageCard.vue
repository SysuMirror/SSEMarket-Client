<script setup lang="ts">
// 生图卡片（B2）：running/progress=虚线占位+百分比+阶段文案；done=图+抽卡/微调按钮；
// failed=错误+重试。percent 是后端时间模型驱动（A3），看门狗按"阶段/百分比距上次变化
// 的间隔"判卡死——2048² 排队随时破固定超时，阈值取 240s。
import type { TimelineImage } from '@/composables/useOpsAgentStream'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'

const props = defineProps<{
  item: TimelineImage
}>()

const emit = defineEmits<{
  (e: 'redo', item: TimelineImage): void
  (e: 'tweak', item: TimelineImage): void
}>()

const STALL_LIMIT_MS = 240_000
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

// 最后一次"活着"的证据：percent/stage 变化时刻（收到事件时重算）
const lastBeat = ref(Date.now())
watch(() => [props.item.percent, props.item.stage, props.item.status], () => {
  lastBeat.value = Date.now()
})

const running = computed(() => props.item.status === 'running' || props.item.status === 'progress')
const stalled = computed(() => running.value && now.value - lastBeat.value > STALL_LIMIT_MS)
const pct = computed(() => Math.max(0, Math.min(100, props.item.percent)))

function open(url: string) {
  window.open(url, '_blank', 'noopener')
}

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 2000)
})
onBeforeUnmount(() => {
  if (timer !== null)
    clearInterval(timer)
})
</script>

<template>
  <div class="img-card" :class="`img-card--${item.status}`">
    <header class="img-card__head">
      <span class="img-card__badge">生图</span>
      <span v-if="running && !stalled" class="img-card__status">
        <LoadingSpinner :size="13" style="margin-right: 4px;" />{{ item.stage || '绘制中' }}… {{ pct }}%
      </span>
      <span v-else-if="running && stalled" class="img-card__status img-card__status--warn">等待过久，可能已中断（可停止后重试）</span>
      <span v-else-if="item.status === 'done'" class="img-card__status img-card__status--ok">已完成</span>
      <span v-else class="img-card__status img-card__status--err">失败</span>
    </header>

    <div v-if="running" class="img-card__placeholder">
      <div class="img-card__bar">
        <div class="img-card__bar-fill" :style="{ width: `${pct}%` }" />
      </div>
      <p class="img-card__hint">
        {{ item.stage === '排队中' ? '前面有生图任务在排队，稍候…' : 'AI 正在绘制，尺寸越大越久' }}
      </p>
    </div>

    <template v-else-if="item.status === 'done' && item.url">
      <img class="img-card__image" :src="item.url" :alt="item.prompt || '生成图片'" loading="lazy" @click="open(item.url!)">
      <footer class="img-card__foot">
        <span v-if="item.size" class="img-card__meta">{{ item.size }}<template v-if="item.seed !== undefined"> · seed {{ item.seed }}</template></span>
        <button type="button" class="img-card__btn" @click="emit('redo', item)">
          重新抽一张
        </button>
        <button type="button" class="img-card__btn img-card__btn--primary" @click="emit('tweak', item)">
          按此微调
        </button>
      </footer>
    </template>

    <div v-else class="img-card__error">
      <p>{{ item.error || '生图未完成' }}</p>
      <button type="button" class="img-card__btn" @click="emit('redo', item)">
        重试
      </button>
    </div>
  </div>
</template>

<style scoped>
.img-card {
  max-width: var(--xq-bubble-max, 640px);
  border: 1px solid var(--xq-border, #e2e8f0);
  border-radius: 12px;
  background: var(--xq-surface, #fff);
  color: var(--xq-text, #1e293b);
  overflow: hidden;
}
.img-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--xq-step-bg, #f8fafc);
  border-bottom: 1px solid var(--xq-border, #e2e8f0);
}
.img-card__badge {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--xq-accent-soft, #ede9fe);
  color: var(--xq-accent-deep, #6d28d9);
}
.img-card__status {
  font-size: 12px;
  color: var(--xq-text-secondary, #475569);
  display: inline-flex;
  align-items: center;
}
.img-card__status--ok {
  color: #16a34a;
}
.img-card__status--err {
  color: #dc2626;
}
.img-card__status--warn {
  color: #d97706;
}
.img-card__placeholder {
  padding: 20px 16px;
  border: 1.5px dashed var(--xq-border, #cbd5e1);
  border-radius: 10px;
  margin: 12px;
  text-align: center;
}
.img-card__bar {
  height: 6px;
  border-radius: 999px;
  background: var(--xq-step-bg, #f1f5f9);
  overflow: hidden;
}
.img-card__bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--xq-accent, #7c3aed), var(--xq-accent-deep, #6d28d9));
  transition: width 1.5s linear;
}
.img-card__hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--xq-text-muted, #94a3b8);
}
.img-card__image {
  display: block;
  width: 100%;
  max-height: 480px;
  object-fit: contain;
  cursor: zoom-in;
  background: #0f172a08;
}
.img-card__foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
}
.img-card__meta {
  font-size: 12px;
  color: var(--xq-text-muted, #94a3b8);
  margin-right: auto;
}
.img-card__btn {
  border: 1px solid var(--xq-border, #e2e8f0);
  background: var(--xq-step-bg, #f8fafc);
  color: var(--xq-text-secondary, #475569);
  border-radius: 8px;
  padding: 4px 12px;
  font-size: 13px;
  cursor: pointer;
}
.img-card__btn--primary {
  background: var(--xq-accent, #7c3aed);
  border-color: var(--xq-accent, #7c3aed);
  color: #fff;
}
.img-card__error {
  padding: 14px 16px;
  font-size: 13px;
  color: #b91c1c;
  display: flex;
  align-items: center;
  gap: 10px;
}

@media (max-width: 768px) {
  /* 手机端「重新抽一张/按此微调」按钮加高到拇指可稳点 */
  .img-card__btn {
    min-height: 36px;
    padding: 6px 14px;
  }
}
</style>
