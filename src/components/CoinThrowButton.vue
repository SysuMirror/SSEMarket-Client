<script setup lang="ts">
import type { CoinTargetType } from '@/api/coin/coin'
import { computed, ref, watch } from 'vue'
import coinIcon from '@/assets/coin-icon.png'
import { showMsg } from '@/components/MessageBox'
import { useUserStore } from '@/store/userStore'
import CoinThrowDialog from './CoinThrowDialog.vue'

/**
 * B 站式投币钮：币图标（币.png）+ 个数。
 *
 * 点击不再直接投币，而是弹出选币弹窗（选 1 枚 / 2 枚、查看余额）；
 * 已投过币（含投满 2 枚）时按钮仍可点——弹窗里可取消投币拿回余额。
 * 每人对每个内容最多 2 币；每投 1 币，投币者自己 +10 主页经验。
 */
const props = withDefaults(
  defineProps<{
    targetType: CoinTargetType
    targetID: number
    /** 我在这条内容上累计投了几个币（含历史投票折算，0–2） */
    myCoins?: number
    /** 这条内容被投币总数（含历史投票折算） */
    coinNum?: number
    /** muted：信息流卡片（横排小图标）；prominent：详情页操作条（与点赞/码住同排） */
    variant?: 'muted' | 'prominent'
    /** 自己的内容不能投自己的币 */
    self?: boolean
    /** 弹窗标题里的对象名（「帖子」/「小说」） */
    targetLabel?: string
  }>(),
  { myCoins: 0, coinNum: 0, variant: 'muted', self: false, targetLabel: '' },
)

const emit = defineEmits<{
  thrown: [myCoins: number, coinNum: number]
}>()

const { isLogin } = useUserStore()
const my = ref(props.myCoins)
const total = ref(props.coinNum)
const dialogOpen = ref(false)

watch(() => [props.myCoins, props.targetID], () => {
  my.value = props.myCoins
  total.value = props.coinNum
})

const blocked = computed(() => !props.targetID || props.self)

// 按钮上不摆文字（B 站式：币形徽标 + 个数），状态说明放 title/aria-label。
// 投满不再禁用——点开弹窗可以取消投币。
const titleText = computed(() => {
  if (props.self)
    return '不能给自己的内容投币'
  if (my.value >= 2)
    return `已投满 ${my.value} 币，点击可取消投币`
  if (my.value === 1)
    return '已投 1 币，点击再投 1 币或取消投币'
  return '投币（每人最多 2 币，每币 +10 主页经验）'
})

function openDialog(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  if (blocked.value)
    return
  if (!isLogin.value) {
    showMsg('登录后才能投币')
    return
  }
  dialogOpen.value = true
}

function onChanged(nextMy: number, delta: number) {
  my.value = nextMy
  // delta：+n 投出去 / -n 撤回；目标总数跟着增减（其余人的币不受影响）
  total.value = Math.max(total.value + delta, 0)
  emit('thrown', my.value, total.value)
}
</script>

<template>
  <button
    type="button"
    class="coin-throw"
    :class="[
      variant === 'prominent' ? 'coin-throw--prominent' : 'coin-throw--muted',
      {
        'coin-throw--thrown': my > 0,
        'coin-throw--off': blocked,
      },
    ]"
    :disabled="blocked"
    :title="titleText"
    :aria-label="`投币，当前 ${total} 币${my > 0 ? `，我已投 ${my} 币` : ''}`"
    @click="openDialog"
  >
    <img
      class="coin-throw__coin"
      :src="coinIcon"
      alt=""
      aria-hidden="true"
      draggable="false"
    >
    <span class="coin-throw__num">{{ total }}</span>
  </button>

  <CoinThrowDialog
    v-if="dialogOpen"
    :target-type="targetType"
    :target-i-d="targetID"
    :my-coins="my"
    :target-label="targetLabel || (targetType === 'novel' ? '小说' : '帖子')"
    @close="dialogOpen = false"
    @changed="onChanged"
  />
</template>

<style scoped lang="scss">
/* B 站式投币钮：币图徽标 + 个数，不放文字。
   投过币后个数变主题蓝、币图带一圈柔光，一眼能看出「我投过」。 */
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

  /* prominent：币在上、个数在下（详情页操作条的竖排位） */
  &--prominent {
    flex: 1;
    flex-direction: column;
    gap: 3px;
    padding: 4px 8px;
    font-size: 12px;
  }

  &--off {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) .coin-throw__coin {
    transform: scale(1.1) rotate(-8deg);
  }

  &:active:not(:disabled) .coin-throw__coin {
    transform: scale(0.94);
  }

  .coin-throw__coin {
    width: 20px;
    height: 20px;
    user-select: none;
    filter: saturate(0.55) opacity(0.82);
    transition:
      transform 0.16s ease,
      filter 0.16s ease;

    /* 投过币：图标恢复全彩 + 柔光 */
    .coin-throw--thrown & {
      filter: saturate(1) drop-shadow(0 0 4px rgb(59 130 246 / 45%));
    }
  }

  .coin-throw__num {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    transition: color 0.16s ease;

    .coin-throw--thrown & {
      color: var(--chat-accent, #3b82f6);
    }
  }
}
</style>
