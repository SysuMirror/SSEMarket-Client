<script setup lang="ts">
import type { CoinTargetType } from '@/api/coin/coin'
import { computed, ref, watch } from 'vue'
import { throwCoin } from '@/api/coin/coin'
import { showMsg } from '@/components/MessageBox'
import { useUserStore } from '@/store/userStore'

/**
 * 投币按钮（B 站式）：给帖子或小说投币，每人对每个内容最多 2 币。
 * 每投 1 币，投币者自己 +10 主页经验。
 *
 * 历史投票已折算为「已经投过的币」，myCoins / coinNum 由后端直接给出，
 * 前端不再单独查投票状态。
 */
const props = withDefaults(
  defineProps<{
    targetType: CoinTargetType
    targetID: number
    /** 我在这条内容上累计投了几个币（含历史投票折算，0–2） */
    myCoins?: number
    /** 这条内容被投币总数（含历史投票折算） */
    coinNum?: number
    /** muted：信息流卡片；prominent：详情页 */
    variant?: 'muted' | 'prominent'
    /** 自己的内容不能投自己的币 */
    self?: boolean
  }>(),
  { myCoins: 0, coinNum: 0, variant: 'muted', self: false },
)

const emit = defineEmits<{
  thrown: [myCoins: number, coinNum: number]
}>()

const { isLogin } = useUserStore()
const my = ref(props.myCoins)
const total = ref(props.coinNum)
const submitting = ref(false)

watch(() => [props.myCoins, props.targetID], () => {
  my.value = props.myCoins
  total.value = props.coinNum
})

const full = computed(() => my.value >= 2)
const blocked = computed(() => !props.targetID || props.self)

// 按钮上不摆文字（B 站式：币形徽标 + 个数），状态说明放 title/aria-label
const titleText = computed(() => {
  if (submitting.value)
    return '投币中…'
  if (props.self)
    return '不能给自己的内容投币'
  if (full.value)
    return `已投满 ${my.value} 币`
  if (my.value === 1)
    return '已投 1 币，可再投 1 币'
  return '投币（每人最多 2 币，每币 +10 主页经验）'
})

async function handleThrow(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  if (blocked.value || submitting.value)
    return
  if (!isLogin.value) {
    showMsg('登录后才能投币')
    return
  }
  if (full.value) {
    showMsg('每人对每个内容最多投 2 币')
    return
  }
  submitting.value = true
  try {
    const { ok, msg, result } = await throwCoin(props.targetType, props.targetID, 1)
    if (ok && result) {
      my.value = result.total
      total.value += 1
      emit('thrown', result.total, total.value)
      showMsg(`已投 1 币 · +${result.exp} 主页经验 · 余 ${result.coinsLeft} 币`)
    }
    else {
      showMsg(msg)
    }
  }
  catch (e) {
    console.error(e)
    showMsg('投币失败')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <button
    type="button"
    class="coin-throw"
    :class="[
      variant === 'prominent' ? 'coin-throw--prominent' : 'coin-throw--muted',
      {
        'coin-throw--full': full,
        'coin-throw--busy': submitting,
        'coin-throw--off': blocked,
      },
    ]"
    :disabled="blocked || submitting"
    :title="titleText"
    :aria-label="titleText"
    @click="handleThrow"
  >
    <span
      class="coin-throw__coin"
      :class="{ 'coin-throw__coin--thrown': my > 0 }"
      aria-hidden="true"
    >币</span>
    <span class="coin-throw__num">{{ total }}</span>
  </button>
</template>

<style scoped lang="scss">
/* B 站式投币钮：圆形「币」徽标 + 个数，不放文字。
   投过币后徽标变实心琥珀色（B 站投过币的币是亮起来的）。 */
.coin-throw {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary, #475569);
  cursor: pointer;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;

  &--muted {
    padding: 2px 4px;
    font-size: 12px;
  }

  /* prominent：币在上、个数在下，贴近 B 站详情页的竖排 */
  &--prominent {
    flex-direction: column;
    gap: 2px;
    padding: 4px 8px;
    font-size: 12px;
  }

  &--full {
    cursor: default;
  }

  &--off {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &--busy {
    opacity: 0.7;
  }

  &:hover:not(:disabled) .coin-throw__coin {
    transform: scale(1.08);
  }

  &--prominent .coin-throw__coin {
    width: 26px;
    height: 26px;
    font-size: 14px;
  }

  .coin-throw__coin {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1.5px solid #d97706;
    color: #b45309;
    background: rgba(245, 158, 11, 0.12);
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    user-select: none;
    transition: transform 0.15s ease, background 0.15s ease, color 0.15s ease;

    &--thrown {
      background: #f59e0b;
      border-color: #d97706;
      color: #fff;
    }
  }

  .coin-throw__num {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
}
</style>
