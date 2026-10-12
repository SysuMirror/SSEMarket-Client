<script setup lang="ts">
import type { CoinTargetType } from '@/api/coin/coin'
import { Icon } from '@iconify/vue'
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

const label = computed(() => {
  if (submitting.value)
    return '投币中'
  if (full.value)
    return `已投 ${my.value}`
  if (my.value === 1)
    return '再投 1 币'
  return '投币'
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
    :title="self ? '不能给自己的内容投币' : '每人最多投 2 币，每币 +10 主页经验'"
    @click="handleThrow"
  >
    <Icon icon="tabler:coin" width="14" height="14" aria-hidden="true" />
    <span>{{ label }}</span>
    <span v-if="total > 0" class="coin-throw__num">{{ total }}</span>
  </button>
</template>

<style scoped lang="scss">
.coin-throw {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.16));
  border-radius: 8px;
  background: var(--color-card, #fff);
  color: var(--color-text-secondary, #475569);
  cursor: pointer;
  white-space: nowrap;

  &--muted {
    padding: 3px 8px;
    font-size: 12px;
  }

  &--prominent {
    padding: 7px 12px;
    font-size: 13px;
    font-weight: 600;
  }

  &--full {
    color: var(--accent, #2c3d56);
    border-color: var(--accent, #2c3d56);
    background: var(--accent-soft, rgba(44, 61, 86, 0.08));
  }

  &--off {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &--busy {
    opacity: 0.7;
  }

  .coin-throw__num {
    font-weight: 700;
  }
}
</style>
