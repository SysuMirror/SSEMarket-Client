<script setup lang="ts">
import type { LotteryMode, LotteryPrizeInput } from '@/api/lottery/lottery'

import { computed } from 'vue'
import { Icon } from '@iconify/vue'

const mode = defineModel<LotteryMode>('mode', { required: true })
const drawAt = defineModel<string>('drawAt', { required: true })
const prizes = defineModel<LotteryPrizeInput[]>('prizes', { required: true })
const open = defineModel<boolean>('open', { default: true })

const modeOptions: { value: LotteryMode, label: string, hint: string }[] = [
  { value: 'random', label: '随机', hint: '开奖时从所有评论者中随机抽取中奖者' },
  { value: 'wish', label: '许愿', hint: '评论包含奖品关键词即进入该奖池，每人每池一次，到期自动开奖' },
]

const activeHint = computed(() => modeOptions.find(o => o.value === mode.value)?.hint ?? '')

function addPrize() {
  prizes.value = [...prizes.value, { name: '', quantity: 1, wishKeyword: '' }]
}

function removePrize(index: number) {
  if (prizes.value.length <= 1)
    return
  prizes.value = prizes.value.filter((_, i) => i !== index)
}

function stepQty(prize: LotteryPrizeInput, delta: number) {
  prize.quantity = Math.min(99, Math.max(1, (Number(prize.quantity) || 1) + delta))
}
</script>

<template>
  <section class="lc" :class="{ 'lc--open': open }">
    <button
      type="button"
      class="lc__head"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="lc__head-label">
        <Icon icon="tabler:gift" width="15" height="15" aria-hidden="true" />
        抽奖设置
        <span class="lc__head-summary" :class="{ 'lc__head-summary--unset': !drawAt }">{{ drawAt ? `${drawAt.replace('T', ' ')} 开奖` : '未设置开奖时间' }}</span>
      </span>
      <Icon
        icon="tabler:chevron-down"
        class="lc__caret"
        width="16"
        height="16"
        aria-hidden="true"
      />
    </button>

    <div v-show="open" class="lc__body">
      <!-- 配置一行：开奖时间 + 模式 -->
      <div class="lc__grid">
        <label class="lc__time">
          <span class="lc__tag"><Icon icon="tabler:calendar-event" width="14" height="14" aria-hidden="true" />开奖时间</span>
          <input
            v-model="drawAt"
            type="datetime-local"
            class="lc__time-input"
          >
        </label>

        <div class="lc__mode-wrap">
          <span class="lc__tag"><Icon icon="tabler:settings-2" width="14" height="14" aria-hidden="true" />抽奖模式</span>
          <div class="lc__modes" role="radiogroup" aria-label="抽奖模式">
            <button
              v-for="opt in modeOptions"
              :key="opt.value"
              type="button"
              class="lc__mode"
              :class="{ 'lc__mode--active': mode === opt.value }"
              role="radio"
              :aria-checked="mode === opt.value"
              @click="mode = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>

      <p class="lc__hint">
        <Icon icon="tabler:info-circle" width="13" height="13" aria-hidden="true" />
        {{ activeHint }}
      </p>

      <!-- 奖品列表 -->
      <div class="lc__prizes">
        <span class="lc__tag lc__tag--prizes">
          <Icon icon="tabler:trophy" width="14" height="14" aria-hidden="true" />
          奖品（{{ prizes.length }}）
        </span>

        <TransitionGroup name="lcprize" tag="ul" class="lc__prize-list">
          <li
            v-for="(prize, index) in prizes"
            :key="index"
            class="lc__prize"
          >
            <span class="lc__prize-idx">{{ index + 1 }}</span>

            <input
              v-model="prize.name"
              type="text"
              class="lc__prize-name"
              placeholder="奖品名称"
              maxlength="20"
            >

            <input
              v-if="mode === 'wish'"
              v-model="prize.wishKeyword"
              type="text"
              class="lc__prize-keyword"
              placeholder="许愿关键词"
              maxlength="12"
            >

            <div class="lc__qty" aria-label="份数">
              <button
                type="button"
                class="lc__qty-btn"
                :disabled="prize.quantity <= 1"
                aria-label="减少"
                @click="stepQty(prize, -1)"
              >
                <Icon icon="tabler:minus" width="13" height="13" aria-hidden="true" />
              </button>
              <span class="lc__qty-num" :title="`${prize.quantity} 份`">{{ prize.quantity }}</span>
              <button
                type="button"
                class="lc__qty-btn"
                aria-label="增加"
                @click="stepQty(prize, 1)"
              >
                <Icon icon="tabler:plus" width="13" height="13" aria-hidden="true" />
              </button>
            </div>

            <button
              v-if="prizes.length > 1"
              type="button"
              class="lc__prize-remove"
              aria-label="删除奖品"
              @click="removePrize(index)"
            >
              <Icon icon="tabler:trash" width="14" height="14" aria-hidden="true" />
            </button>
          </li>
        </TransitionGroup>

        <button type="button" class="lc__add" @click="addPrize">
          <Icon icon="tabler:plus" width="14" height="14" aria-hidden="true" />
          添加奖品
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.lc {
  padding: 4px 14px 12px;
}

.lc__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 6px 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}

.lc__head-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--chat-text);
}

.lc__head-summary {
  font-weight: 400;
  color: var(--chat-text-tips);
  font-variant-numeric: tabular-nums;

  &--unset {
    opacity: 0.7;
  }
}

.lc__caret {
  flex-shrink: 0;
  color: var(--chat-text-tips);
  transition: transform 0.2s ease;
}

.lc--open .lc__caret {
  transform: rotate(180deg);
}

.lc__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 4px;
}

/* —— 配置一行 —— */
.lc__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  align-items: end;
}

.lc__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 5px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--chat-text-tips);
}

.lc__time {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.lc__time-input {
  width: 100%;
  min-height: 34px;
  padding: 5px 10px;
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  background: var(--chat-bg-main);
  color: var(--chat-text);
  font-size: 0.8125rem;
  font-family: inherit;
  box-sizing: border-box;
  font-variant-numeric: tabular-nums;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;

  &:focus {
    outline: none;
    border-color: var(--chat-accent);
    box-shadow: 0 0 0 2px var(--chat-accent-soft);
  }
}

.lc__mode-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.lc__modes {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  background: var(--chat-bg-main);
}

.lc__mode {
  flex: 1;
  padding: 6px 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--chat-text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;

  &--active {
    background: var(--chat-accent);
    color: #fff;
    font-weight: 600;
  }
}

.lc__hint {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: -2px 0 0;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--chat-text-tips);

  svg {
    flex-shrink: 0;
  }
}

/* —— 奖品列表 —— */
.lc__prizes {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lc__tag--prizes {
  margin-bottom: 1px;
}

.lc__prize-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lc__prize {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px 5px 5px;
  border: 1px solid var(--chat-border);
  border-radius: 10px;
  background: var(--chat-bg-main);
  transition:
    border-color 0.15s,
    box-shadow 0.15s;

  &:focus-within {
    border-color: var(--chat-accent);
    box-shadow: 0 0 0 2px var(--chat-accent-soft);
  }
}

.lc__prize-idx {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--chat-accent-soft, rgba(0, 0, 0, 0.05));
  color: var(--chat-accent);
  font-size: 0.6875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.lc__prize-name {
  flex: 1;
  min-width: 0;
  min-height: 30px;
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--chat-text);
  font-size: 0.8125rem;
  font-family: inherit;

  &::placeholder {
    color: var(--chat-text-tips);
  }

  &:focus {
    outline: none;
    background: var(--chat-bg-highlight, rgba(0, 0, 0, 0.03));
  }
}

.lc__prize-keyword {
  flex: 0 1 150px;
  min-width: 90px;
  min-height: 30px;
  padding: 4px 8px;
  border: 1px dashed var(--chat-border);
  border-radius: 6px;
  background: transparent;
  color: var(--chat-text);
  font-size: 0.8125rem;
  font-family: inherit;

  &::placeholder {
    color: var(--chat-text-tips);
  }

  &:focus {
    outline: none;
    border-color: var(--chat-accent);
    border-style: solid;
  }
}

.lc__qty {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  padding: 2px;
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  background: var(--chat-bg-highlight, rgba(0, 0, 0, 0.02));
}

.lc__qty-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--chat-text-secondary);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;

  &:hover:not(:disabled) {
    background: var(--chat-accent-soft, rgba(0, 0, 0, 0.05));
    color: var(--chat-accent);
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
}

.lc__qty-num {
  min-width: 22px;
  text-align: center;
  font-size: 0.8125rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--chat-text);
}

.lc__prize-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--chat-text-tips);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;

  &:hover {
    background: #fee2e2;
    color: #dc2626;
  }
}

.lc__add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 32px;
  border: 1px dashed var(--chat-border);
  border-radius: 10px;
  background: transparent;
  color: var(--chat-text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;

  &:hover {
    color: var(--chat-accent);
    border-color: var(--chat-accent);
    background: var(--chat-accent-soft, transparent);
  }
}

/* —— 行增删过渡 —— */
.lcprize-enter-active,
.lcprize-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.lcprize-enter-from,
.lcprize-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.lcprize-leave-active {
  position: absolute;
  width: 100%;
}

.lcprize-move {
  transition: transform 0.18s ease;
}

/* —— 移动端 —— */
@media screen and (max-width: 768px) {
  .lc {
    padding: 2px 10px 10px;
  }

  .lc__grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .lc__prize {
    flex-wrap: wrap;
    row-gap: 5px;
  }

  .lc__prize-name {
    flex: 1 1 55%;
  }

  .lc__prize-keyword {
    flex: 1 1 55%;
    order: 5;
    margin-left: 30px;
  }

  .lc__qty {
    order: 4;
  }

  .lc__prize-remove {
    order: 6;
  }
}
</style>
