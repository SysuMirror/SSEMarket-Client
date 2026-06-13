<script setup lang="ts">
import type { LotteryDetail } from '@/api/lottery/lottery'

import { Icon } from '@iconify/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import LotteryLink from '@/components/LotteryLink.vue'

const props = defineProps<{
  postID: number
  lottery: LotteryDetail | null
}>()

const emit = defineEmits<{
  refresh: []
}>()

const now = ref(Date.now())
let timer: number | null = null
let refreshTimer: number | null = null

const isActive = computed(() => props.lottery?.status === 'active')
const isDrawn = computed(() => props.lottery?.status === 'drawn' || props.lottery?.status === 'closed')
const isWish = computed(() => props.lottery?.mode === 'wish')

const countdown = computed(() => {
  if (!props.lottery?.drawAt || !isActive.value)
    return null
  const end = Date.parse(props.lottery.drawAt.replace(' ', 'T'))
  const diff = end - now.value
  if (diff <= 0)
    return { expired: true as const, h: 0, m: 0, s: 0 }
  return {
    expired: false as const,
    h: Math.floor(diff / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  }
})

const totalParticipants = computed(() => {
  if (!props.lottery)
    return 0
  if (isWish.value)
    return props.lottery.prizes.reduce((sum, p) => sum + (p.participantCount ?? 0), 0)
  return props.lottery.participantCount
})

function pad(n: number) {
  return String(n).padStart(2, '0')
}

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (timer)
    clearInterval(timer)
  if (refreshTimer)
    clearInterval(refreshTimer)
})

watch(
  () => countdown.value?.expired,
  (expired) => {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
    if (expired && isActive.value) {
      emit('refresh')
      refreshTimer = window.setInterval(() => emit('refresh'), 15000)
    }
  },
  { immediate: true },
)
</script>

<template>
  <section v-if="lottery" class="lottery-panel">
    <header class="lottery-panel__head">
      <h2 class="lottery-panel__title">抽奖</h2>
      <span class="lottery-panel__meta">
        {{ isWish ? '许愿抽奖' : '随机抽奖' }}
        ·
        {{ isDrawn ? '已开奖' : '进行中' }}
      </span>
    </header>

    <div v-if="isActive && countdown" class="lottery-panel__countdown">
      <template v-if="countdown.expired">
        <Icon icon="tabler:loader" width="16" height="16" class="lottery-panel__spin" />
        已到开奖时间，等待开奖…
      </template>
      <template v-else>
        距离开奖 {{ pad(countdown.h) }}:{{ pad(countdown.m) }}:{{ pad(countdown.s) }}
      </template>
    </div>

    <p class="lottery-panel__stat">
      {{ totalParticipants }} 人次参与
      <template v-if="isWish && lottery.participated"> · 你已参与</template>
    </p>

    <p v-if="isWish && isActive" class="lottery-panel__hint">
      在评论区发送含对应关键词的评论即可参与该奖品奖池；同一奖池每人仅计一次；开奖时间到达后自动开奖。
    </p>

    <ul class="lottery-panel__prizes">
      <li
        v-for="p in lottery.prizes"
        :key="p.prizeID"
        class="lottery-panel__prize"
        :class="{ 'lottery-panel__prize--joined': p.participated }"
      >
        <span class="lottery-panel__prize-name">{{ p.name }}</span>
        <span class="lottery-panel__prize-qty">× {{ p.quantity }}</span>
        <span v-if="p.wishKeyword" class="lottery-panel__keyword">{{ p.wishKeyword }}</span>
        <span v-if="isWish" class="lottery-panel__prize-count">{{ p.participantCount ?? 0 }} 人</span>
        <span v-if="p.participated" class="lottery-panel__joined">已参与</span>
      </li>
    </ul>

    <div v-if="isActive && !isWish" class="lottery-panel__action">
      <LotteryLink
        :post-i-d="postID"
        :participated="lottery.participated"
        variant="prominent"
        @participated="emit('refresh')"
      />
    </div>

    <div v-if="isDrawn" class="lottery-panel__result">
      <h3 class="lottery-panel__result-title">
        中奖名单
      </h3>
      <ul v-if="lottery.winners?.length" class="lottery-panel__winners">
        <li v-for="(w, i) in lottery.winners" :key="i" class="lottery-panel__winner">
          <span class="lottery-panel__winner-name">{{ w.userName }}</span>
          <span class="lottery-panel__winner-prize">{{ w.prizeName }}</span>
        </li>
      </ul>
      <p v-else class="lottery-panel__empty">
        暂无中奖者
      </p>
    </div>
  </section>
</template>

<style scoped lang="scss">
.lottery-panel {
  margin: 12px 0 0;
  padding: 12px 16px;
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  background: var(--chat-bg-highlight);
}

.lottery-panel__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.lottery-panel__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--chat-text);
}

.lottery-panel__meta {
  font-size: 0.8125rem;
  color: var(--chat-text-secondary);
}

.lottery-panel__countdown {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 0.875rem;
  color: var(--chat-text-secondary);
  font-variant-numeric: tabular-nums;
}

.lottery-panel__spin {
  animation: lottery-spin 1.2s linear infinite;
}

@keyframes lottery-spin {
  to { transform: rotate(360deg); }
}

.lottery-panel__stat {
  margin: 0 0 10px;
  font-size: 0.8125rem;
  color: var(--chat-text-secondary);
}

.lottery-panel__prizes {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
  border-top: 1px solid var(--chat-border);
}

.lottery-panel__prize {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid var(--chat-border);
  font-size: 0.875rem;

  &--joined {
    background: var(--chat-accent-soft);
    margin: 0 -16px;
    padding-left: 16px;
    padding-right: 16px;
  }
}

.lottery-panel__prize-name {
  font-weight: 600;
  color: var(--chat-text);
}

.lottery-panel__prize-qty {
  color: var(--chat-text-secondary);
}

.lottery-panel__keyword {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--chat-bg-main);
  border: 1px solid var(--chat-border);
  font-size: 0.75rem;
  color: var(--chat-text-secondary);
}

.lottery-panel__prize-count {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--chat-text-tips);
}

.lottery-panel__joined {
  font-size: 0.75rem;
  color: var(--chat-accent);
  font-weight: 500;
}

.lottery-panel__hint {
  margin: 0 0 10px;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--hp-muted, var(--chat-text-tips));
}

.lottery-panel__action {
  padding-top: 4px;
}

.lottery-panel__result {
  padding-top: 10px;
  border-top: 1px solid var(--chat-border);
}

.lottery-panel__result-title {
  margin: 0 0 8px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--chat-text);
}

.lottery-panel__winners {
  list-style: none;
  margin: 0;
  padding: 0;
}

.lottery-panel__winner {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--chat-border);
  font-size: 0.875rem;

  &:last-child {
    border-bottom: none;
  }
}

.lottery-panel__winner-name {
  font-weight: 500;
  color: var(--chat-text);
}

.lottery-panel__winner-prize {
  color: var(--chat-text-secondary);
  text-align: right;
}

.lottery-panel__empty {
  margin: 0;
  font-size: 0.875rem;
  color: var(--chat-text-tips);
}
</style>
