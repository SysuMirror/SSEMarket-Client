<script setup lang="ts">
import type { LotteryMode, LotteryPrizeInput } from '@/api/lottery/lottery'

import { Icon } from '@iconify/vue'

const mode = defineModel<LotteryMode>('mode', { required: true })
const drawAt = defineModel<string>('drawAt', { required: true })
const prizes = defineModel<LotteryPrizeInput[]>('prizes', { required: true })
const open = defineModel<boolean>('open', { default: true })

const modeOptions: { value: LotteryMode, label: string }[] = [
  { value: 'random', label: '随机抽奖' },
  { value: 'wish', label: '许愿抽奖' },
]

function addPrize() {
  prizes.value = [...prizes.value, { name: '', quantity: 1, wishKeyword: '' }]
}

function removePrize(index: number) {
  if (prizes.value.length <= 1)
    return
  prizes.value = prizes.value.filter((_, i) => i !== index)
}
</script>

<template>
  <section class="lottery-config" :class="{ 'lottery-config--open': open }">
    <button
      type="button"
      class="lottery-config__toggle"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="lottery-config__toggle-label">抽奖设置</span>
      <Icon
        icon="tabler:chevron-down"
        class="lottery-config__chevron"
        width="18"
        height="18"
        aria-hidden="true"
      />
    </button>

    <div v-show="open" class="lottery-config__body">
      <div class="lottery-config__field">
        <span class="lottery-config__label">抽奖模式</span>
        <div class="lottery-config__modes" role="radiogroup" aria-label="抽奖模式">
          <button
            v-for="opt in modeOptions"
            :key="opt.value"
            type="button"
            class="lottery-config__mode"
            :class="{ 'lottery-config__mode--active': mode === opt.value }"
            role="radio"
            :aria-checked="mode === opt.value"
            @click="mode = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
        <p v-if="mode === 'wish'" class="lottery-config__hint">
          评论含对应关键词即可参与该奖品奖池；每个奖池仅计一次；到期自动开奖。
        </p>
        <p v-else class="lottery-config__hint">
          到期后从参与者中随机抽取中奖者。
        </p>
      </div>

      <label class="lottery-config__field">
        <span class="lottery-config__label">开奖时间</span>
        <input
          v-model="drawAt"
          type="datetime-local"
          class="lottery-config__input"
        >
      </label>

      <div class="lottery-config__field">
        <div class="lottery-config__prize-head">
          <span class="lottery-config__label">奖品</span>
          <button type="button" class="lottery-config__add" @click="addPrize">
            添加
          </button>
        </div>

        <ul class="lottery-config__prize-list">
          <li
            v-for="(prize, index) in prizes"
            :key="index"
            class="lottery-config__prize-row"
          >
            <template v-if="mode === 'random'">
              <div class="lottery-config__prize-line">
                <input
                  v-model="prize.name"
                  type="text"
                  class="lottery-config__input lottery-config__input--grow"
                  placeholder="奖品名称"
                >
                <label class="lottery-config__inline-field">
                  <span class="lottery-config__inline-label">份数</span>
                  <input
                    v-model.number="prize.quantity"
                    type="number"
                    min="1"
                    class="lottery-config__input lottery-config__input--qty"
                  >
                </label>
                <button
                  v-if="prizes.length > 1"
                  type="button"
                  class="lottery-config__remove"
                  aria-label="删除奖品"
                  @click="removePrize(index)"
                >
                  <Icon icon="tabler:x" width="16" height="16" />
                </button>
              </div>
            </template>
            <template v-else>
              <input
                v-model="prize.name"
                type="text"
                class="lottery-config__input"
                placeholder="奖品名称"
              >
              <div class="lottery-config__prize-meta">
                <label class="lottery-config__inline-field">
                  <span class="lottery-config__inline-label">份数</span>
                  <input
                    v-model.number="prize.quantity"
                    type="number"
                    min="1"
                    class="lottery-config__input lottery-config__input--qty"
                  >
                </label>
                <label class="lottery-config__inline-field lottery-config__inline-field--grow">
                  <span class="lottery-config__inline-label">关键词</span>
                  <input
                    v-model="prize.wishKeyword"
                    type="text"
                    class="lottery-config__input"
                    placeholder="许愿关键词"
                  >
                </label>
                <button
                  v-if="prizes.length > 1"
                  type="button"
                  class="lottery-config__remove"
                  aria-label="删除奖品"
                  @click="removePrize(index)"
                >
                  <Icon icon="tabler:x" width="16" height="16" />
                </button>
              </div>
            </template>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.lottery-config {
  margin-top: 12px;
  border: 1px solid var(--chat-border);
  border-radius: 10px;
  background: var(--chat-bg-highlight);
  overflow: hidden;
}

.lottery-config__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}

.lottery-config__toggle-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--chat-text);
}

.lottery-config__chevron {
  flex-shrink: 0;
  color: var(--chat-text-tips);
  transition: transform 0.2s ease;
}

.lottery-config--open .lottery-config__chevron {
  transform: rotate(180deg);
}

.lottery-config__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 12px 12px;
  border-top: 1px solid var(--chat-border);
}

.lottery-config__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
}

.lottery-config__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--chat-text-tips);
  letter-spacing: 0.04em;
}

.lottery-config__modes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 2px;
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  background: var(--chat-bg-main);
}

.lottery-config__mode {
  padding: 8px 10px;
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
    background: var(--chat-bg-highlight);
    color: var(--chat-text);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }
}

.lottery-config__input {
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid var(--chat-border);
  border-radius: 10px;
  background: var(--chat-bg-main);
  color: var(--chat-text);
  font-size: 0.9375rem;
  font-family: inherit;
  box-sizing: border-box;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;

  &:focus {
    outline: none;
    border-color: var(--chat-accent);
    box-shadow: 0 0 0 2px var(--chat-accent-soft);
  }

  &--qty {
    width: 72px;
    min-width: 72px;
  }
}

.lottery-config__prize-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.lottery-config__add {
  padding: 4px 10px;
  border: 1px solid var(--chat-border);
  border-radius: 8px;
  background: var(--chat-bg-main);
  color: var(--chat-text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;

  &:hover {
    color: var(--chat-accent);
    border-color: var(--chat-accent);
  }
}

.lottery-config__prize-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lottery-config__hint {
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--hp-muted, var(--chat-text-tips));
}

.lottery-config__prize-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lottery-config__prize-line {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  align-items: center;
}

.lottery-config__input--grow {
  flex: 1;
  min-width: 0;
  width: auto;
}

.lottery-config__prize-meta {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  align-items: center;
}

.lottery-config__inline-field {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;

  &--grow {
    flex: 1;
    min-width: 0;

    .lottery-config__input {
      flex: 1;
      min-width: 0;
      width: auto;
    }
  }
}

.lottery-config__inline-label {
  font-size: 0.6875rem;
  color: var(--chat-text-tips);
  flex-shrink: 0;
}

.lottery-config__remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 40px;
  border: 1px solid var(--chat-border);
  border-radius: 10px;
  background: var(--chat-bg-main);
  color: var(--chat-text-secondary);
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    color: #dc2626;
    border-color: #fecaca;
  }
}

@media (max-width: 520px) {
  .lottery-config__modes {
    grid-template-columns: 1fr;
  }
}
</style>
