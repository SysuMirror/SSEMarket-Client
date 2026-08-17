<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  stars: [number, number, number, number, number]
  averageRating?: number
  userRating?: number
  showUserRating?: boolean
  dense?: boolean
}>()

const emits = defineEmits<{
  ratingClick: [rating: number]
}>()

const total = computed(() => (props.stars || []).reduce((sum, v) => sum + v, 0))

function barWidth(count: number) {
  return total.value > 0 ? Math.round((count / total.value) * 100) : 0
}

const starRows = computed(() =>
  (props.stars || []).map((count, index) => ({
    star: index + 1,
    count,
    width: barWidth(count),
  })).reverse(),
)
</script>

<template>
  <section
    class="hp-rd"
    :class="{ 'hp-rd--dense': dense }"
    aria-label="评分统计"
  >
    <div class="hp-rd__layout">
      <div class="hp-rd__aside">
        <div class="hp-rd__score">
          <span class="hp-rd__score-num">{{ (averageRating || 0).toFixed(1) }}</span>
          <span class="hp-rd__score-sub">综合 · {{ total }}人</span>
        </div>
        <div v-if="showUserRating" class="hp-rd__mine">
          <span class="hp-rd__mine-label">我的评分</span>
          <div class="hp-rd__stars" role="group" aria-label="选择星级">
            <button
              v-for="n in 5"
              :key="n"
              type="button"
              class="hp-rd__star"
              :class="{ 'hp-rd__star--on': n <= (userRating || 0) }"
              :aria-label="`${n} 星`"
              @click="emits('ratingClick', n)"
            >
              ★
            </button>
          </div>
        </div>
      </div>

      <div class="hp-rd__bars">
        <div v-for="row in starRows" :key="row.star" class="hp-rd__row">
          <span class="hp-rd__row-lbl">{{ row.star }}星</span>
          <div class="hp-rd__track">
            <div class="hp-rd__fill" :style="{ width: `${row.width}%` }" />
          </div>
          <span class="hp-rd__row-n">{{ row.count }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.hp-rd {
  border: 1px solid var(--hp-border, var(--chat-border));
  border-radius: 10px;
  background: var(--hp-card, var(--chat-bg-elevated));
  padding: 12px;
}

.hp-rd__layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hp-rd__aside {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.hp-rd__score {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.hp-rd__score-num {
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
  color: var(--chat-accent);
  font-variant-numeric: tabular-nums;
}

.hp-rd__score-sub {
  font-size: 11px;
  color: var(--hp-muted, var(--chat-text-secondary));
  font-weight: 600;
}

.hp-rd__mine {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hp-rd__mine-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--hp-muted, var(--chat-text-secondary));
}

.hp-rd__stars {
  display: flex;
  gap: 2px;
}

.hp-rd__star {
  padding: 0;
  border: none;
  background: none;
  font-size: 22px;
  line-height: 1;
  color: var(--chat-border-strong, #ddd);
  cursor: pointer;
  transition:
    transform 0.1s ease,
    color 0.1s ease;

  &--on {
    color: var(--chat-accent);
  }

  &:hover {
    transform: scale(1.1);
    color: var(--chat-accent);
  }
}

.hp-rd__bars {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.hp-rd__row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hp-rd__row-lbl {
  width: 28px;
  font-size: 11px;
  font-weight: 600;
  color: var(--hp-muted, var(--chat-text-secondary));
  text-align: right;
  flex-shrink: 0;
}

.hp-rd__track {
  flex: 1;
  height: 6px;
  background: var(--chat-bg-muted, #f0f2f5);
  border-radius: 3px;
  overflow: hidden;
}

.hp-rd__fill {
  height: 100%;
  background: var(--chat-accent);
  border-radius: 3px;
  transition: width 0.35s ease;
}

.hp-rd__row-n {
  width: 24px;
  font-size: 11px;
  font-weight: 600;
  color: var(--hp-muted, var(--chat-text-secondary));
  text-align: right;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

@media screen and (min-width: 520px) {
  .hp-rd--dense .hp-rd__layout {
    flex-direction: row;
    align-items: stretch;
    gap: 14px;
  }

  .hp-rd--dense .hp-rd__aside {
    flex: 0 0 148px;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    padding-right: 12px;
    border-right: 1px solid var(--hp-border, var(--chat-border));
  }

  .hp-rd--dense .hp-rd__bars {
    flex: 1;
    justify-content: center;
  }

  .hp-rd--dense .hp-rd__score {
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }

  .hp-rd--dense .hp-rd__score-num {
    font-size: 36px;
  }
}
</style>
