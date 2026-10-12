<script setup lang="ts">
import type { CoinTargetType } from '@/api/coin/coin'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { cancelCoin, getCoinSummary, throwCoin } from '@/api/coin/coin'
import coinBar from '@/assets/coin-dialog-bar.png'
import coinIcon from '@/assets/coin-icon.png'
import coinMascot1 from '@/assets/coin-mascot-1.png'
import coinMascot2 from '@/assets/coin-mascot-2.png'
import { showMsg } from '@/components/MessageBox'
import { useUserStore } from '@/store/userStore'

/**
 * B 站式投币弹窗：选 1 枚 / 2 枚（立绘卡片），展示余额，
 * 已投过时可「再投 1 枚」或「取消投币」（撤回全部并退币）。
 *
 * 余额在打开时从后端现取（getCoinSummary），不用 /auth/info 的会话快照——
 * 那份快照在币变动后可能偏旧。投/取消成功后同步回 userStore，
 * 个人主页 / 设置页的余额就跟着新了。
 */
const props = withDefaults(
  defineProps<{
    targetType: CoinTargetType
    targetID: number
    /** 我在该内容上已投着的币数（0–2） */
    myCoins: number
    /** 弹窗标题里的对象：「帖子」/「小说」 */
    targetLabel?: string
  }>(),
  { targetLabel: '内容' },
)

const emit = defineEmits<{
  close: []
  /** my：我最终投着几个；delta：目标币数的增量（+n / -n）；coinsLeft：最新余额 */
  changed: [my: number, delta: number, coinsLeft: number]
}>()

const userStore = useUserStore()
const my = ref(props.myCoins)
const selected = ref<1 | 2>(1)
const balance = ref<number | null>(null)
const submitting = ref(false)
const boxRef = ref<HTMLDivElement>()

const canThrow = computed(() => my.value < 2)
const canAfford = computed(() => balance.value === null || balance.value >= selected.value)
const targetName = computed(() => (props.targetType === 'novel' ? '小说' : '帖子'))

onMounted(async () => {
  boxRef.value?.focus()
  window.addEventListener('keydown', onKeydown)
  // 余额现取：会话快照可能偏旧，弹窗里必须给准确数
  const summary = await getCoinSummary()
  if (summary)
    balance.value = summary.coins
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape')
    emit('close')
}

function syncBalance(coinsLeft: number) {
  balance.value = coinsLeft
  // 会话快照同步：个人主页 / 设置页读的 userInfo.coins 跟着更新
  userStore.userInfo.coins = coinsLeft
}

async function submitThrow() {
  if (submitting.value)
    return
  if (!canThrow.value) {
    showMsg('每人对每个内容最多投 2 币', 'warning')
    return
  }
  if (!canAfford.value) {
    showMsg('币不够，先去赚点币吧', 'warning')
    return
  }
  submitting.value = true
  try {
    const { ok, msg, result } = await throwCoin(props.targetType, props.targetID, selected.value)
    if (ok && result) {
      syncBalance(result.coinsLeft)
      const delta = selected.value
      my.value = result.total
      emit('changed', result.total, delta, result.coinsLeft)
      showMsg(`已投 ${delta} 币 · +${result.exp} 主页经验`, 'success')
      emit('close')
    }
    else {
      showMsg(msg, 'error')
    }
  }
  catch (e) {
    console.error(e)
    showMsg('投币失败', 'error')
  }
  finally {
    submitting.value = false
  }
}

async function submitCancel() {
  if (submitting.value)
    return
  submitting.value = true
  try {
    const { ok, msg, result } = await cancelCoin(props.targetType, props.targetID)
    if (ok && result) {
      syncBalance(result.coinsLeft)
      const refunded = result.coins
      my.value = result.total
      emit('changed', result.total, -refunded, result.coinsLeft)
      showMsg(`已取消投币 · 退回 ${refunded} 币`, 'success')
      emit('close')
    }
    else {
      showMsg(msg, 'error')
      // 后端说没有投着的币了（别处已取消）：把本地状态对齐，避免卡死在旧状态
      if (msg.includes('还没有投过币')) {
        my.value = 0
        emit('changed', 0, 0, balance.value ?? 0)
        emit('close')
      }
    }
  }
  catch (e) {
    console.error(e)
    showMsg('取消失败', 'error')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="coin-dlg-mask" @click.self="emit('close')">
      <div
        ref="boxRef"
        class="coin-dlg"
        role="dialog"
        aria-modal="true"
        aria-label="投币"
        tabindex="-1"
      >
        <!-- 卡片顶部的装饰带（小人趴栏杆 + 两端花）：整条按固定宽高比贴，
             弹窗宽度封顶在 360px，装饰端不会被拉变形。
             素材中段几乎空白、栏杆本身很淡，所以不做 border-image 九宫格切片
             （切片会把栏杆拉散）；正式的可拉伸框素材到位后再换。 -->
        <img
          class="coin-dlg__bar"
          :src="coinBar"
          alt=""
          aria-hidden="true"
          draggable="false"
        >
        <button
          type="button"
          class="coin-dlg__close"
          aria-label="关闭"
          @click="emit('close')"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M5.7 5.7a1 1 0 0 1 1.4 0L12 10.6l4.9-4.9a1 1 0 1 1 1.4 1.4L13.4 12l4.9 4.9a1 1 0 1 1-1.4 1.4L12 13.4l-4.9 4.9a1 1 0 1 1-1.4-1.4L10.6 12 5.7 7.1a1 1 0 0 1 0-1.4z"
              fill="currentColor"
            />
          </svg>
        </button>

        <h3 class="coin-dlg__title">
          <template v-if="my > 0">
            已投 <span class="coin-dlg__num">{{ my }}</span> 枚币
          </template>
          <template v-else>
            给这条{{ targetName }}投上 <span class="coin-dlg__num">{{ selected }}</span> 枚币
          </template>
        </h3>

        <!-- 选币卡片：1 枚 / 2 枚（B 站式，立绘手里举的币数对应档位）。
             已投 1 枚时只剩「再投 1 枚」一个选项：2 币卡禁用，1 币卡保持可点。 -->
        <div v-if="canThrow" class="coin-dlg__cards">
          <button
            type="button"
            class="coin-dlg__card"
            :class="{ 'coin-dlg__card--selected': selected === 1 }"
            :aria-pressed="selected === 1"
            @click="selected = 1"
          >
            <span class="coin-dlg__card-label">1 币</span>
            <img class="coin-dlg__mascot" :src="coinMascot1" alt="投 1 枚币" draggable="false">
          </button>
          <button
            type="button"
            class="coin-dlg__card"
            :class="{ 'coin-dlg__card--selected': selected === 2 }"
            :disabled="my === 1"
            :aria-pressed="selected === 2"
            @click="selected = 2"
          >
            <span class="coin-dlg__card-label">2 币</span>
            <img class="coin-dlg__mascot" :src="coinMascot2" alt="投 2 枚币" draggable="false">
          </button>
        </div>
        <p v-if="my === 1" class="coin-dlg__hint">
          已投 1 枚，只能再投 1 枚
        </p>

        <!-- 已投着币：给一个明确可见的取消入口（退币 + 回退经验） -->
        <button
          v-if="my > 0"
          type="button"
          class="coin-dlg__cancel"
          :disabled="submitting"
          @click="submitCancel"
        >
          取消投币（退回 {{ my }} 币）
        </button>

        <div class="coin-dlg__foot">
          <span class="coin-dlg__balance">
            <img class="coin-dlg__balance-coin" :src="coinIcon" alt="" aria-hidden="true">
            我的余额：<b>{{ balance === null ? '…' : balance }}</b> 币
          </span>
          <button
            v-if="canThrow"
            type="button"
            class="coin-dlg__submit"
            :disabled="submitting || !canAfford"
            @click="submitThrow"
          >
            {{ submitting ? '投币中…' : '确定' }}
          </button>
        </div>
        <p class="coin-dlg__exp">
          每投 1 枚 +10 主页经验 · 每人对每个内容最多投 2 枚
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
/* 桌面：居中弹窗（B 站 PC 式）；移动端：底部面板（B 站 App 式）。
   层级：底栏 2000 / 站点头 2100 都要被弹窗盖住（之前取 1002 被底栏压在下面，
   手机上「确定」按钮整块看不见），但全局 toast 会抬到 4000 浮在弹窗之上。 */
.coin-dlg-mask {
  position: fixed;
  inset: 0;
  z-index: 2150;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 45%);
  animation: coin-dlg-fade 0.16s ease;
}

.coin-dlg {
  position: relative;
  width: min(360px, calc(100vw - 32px));
  /* 矮屏 / 横屏手机：内容超高时面板内部滚动，余额与「确定」不会被顶出屏幕 */
  max-height: calc(100vh - 24px);
  overflow-y: auto;
  box-sizing: border-box;
  padding: 14px 18px 12px;
  text-align: center;
  background: var(--color-card, #fff);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgb(0 0 0 / 18%);
  outline: none;
  animation: coin-dlg-pop 0.18s ease;
}

/* 装饰带通铺到卡片左右边缘（用负 margin 抵消卡片的横向 padding） */
.coin-dlg__bar {
  display: block;
  width: calc(100% + 36px);
  height: auto;
  margin: -14px -18px 8px;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: none;
  -webkit-user-drag: none;
}

/* 素材是浅粉彩 + 近白底，压在暗色卡片上会是一块亮斑：暗色模式不贴装饰 */
body.dark-mode .coin-dlg__bar {
  display: none;
}

.coin-dlg__close {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--color-text-tertiary, #94a3b8);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 50%;

  &:hover {
    color: var(--color-text, #1f2937);
    background: rgb(0 0 0 / 6%);
  }
}

.coin-dlg__title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text, #1f2937);
}

.coin-dlg__num {
  padding: 0 2px;
  font-size: 20px;
  font-weight: 700;
  color: var(--chat-accent, #3b82f6);
  vertical-align: -1px;
}

.coin-dlg__cards {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.coin-dlg__card {
  flex: 1;
  max-width: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 8px 6px;
  cursor: pointer;
  background: var(--color-bg, #f8fafc);
  border: 1.5px solid var(--chat-border, #e2e8f0);
  border-radius: 10px;
  transition:
    border-color 0.14s ease,
    box-shadow 0.14s ease,
    transform 0.14s ease;
  -webkit-tap-highlight-color: transparent;

  &:hover:not(:disabled) {
    border-color: var(--chat-accent, #3b82f6);
  }

  &--selected {
    background: var(--chat-accent-soft, #eff6ff);
    border-color: var(--chat-accent, #3b82f6);
    box-shadow: 0 0 0 1px var(--chat-accent, #3b82f6) inset;
  }

  &--dim {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.coin-dlg__card-label {
  align-self: flex-start;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #475569);
}

.coin-dlg__mascot {
  width: 80px;
  height: auto;
  user-select: none;
  pointer-events: none;
}

.coin-dlg__hint {
  margin: 8px 0 0;
  font-size: 11.5px;
  color: var(--color-text-tertiary, #94a3b8);
}

.coin-dlg__cancel {
  display: block;
  width: 100%;
  margin-top: 10px;
  padding: 8px 0;
  font-size: 12.5px;
  font-weight: 600;
  font-family: inherit;
  color: #dc2626;
  cursor: pointer;
  background: transparent;
  border: 1.5px dashed rgb(220 38 38 / 45%);
  border-radius: 8px;
  transition:
    background 0.14s ease,
    border-color 0.14s ease;
  -webkit-tap-highlight-color: transparent;

  &:hover:not(:disabled) {
    background: rgb(220 38 38 / 6%);
    border-color: #dc2626;
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}

.coin-dlg__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
}

.coin-dlg__balance {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--color-text-secondary, #475569);

  b {
    font-variant-numeric: tabular-nums;
  }
}

.coin-dlg__balance-coin {
  width: 18px;
  height: 18px;
}

.coin-dlg__submit {
  min-width: 88px;
  padding: 7px 18px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  cursor: pointer;
  background: var(--chat-accent, #3b82f6);
  border: none;
  border-radius: 8px;
  transition:
    filter 0.14s ease,
    opacity 0.14s ease;
  -webkit-tap-highlight-color: transparent;

  &:hover:not(:disabled) {
    filter: brightness(1.06);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.coin-dlg__exp {
  margin: 8px 0 0;
  font-size: 11.5px;
  color: var(--color-text-tertiary, #94a3b8);
}

@keyframes coin-dlg-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes coin-dlg-pop {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media screen and (max-width: 768px) {
  .coin-dlg-mask {
    align-items: flex-end;
  }

  .coin-dlg {
    width: 100%;
    /* 宽度封顶：底部面板再宽，装饰带也不会被跟着拉宽变形 */
    max-width: 380px;
    /* 底部面板贴住屏幕下沿，安全区内缩一点，别让 home 条压住内容 */
    padding: 14px 16px calc(12px + env(safe-area-inset-bottom));
    border-radius: 14px 14px 0 0;
    animation: coin-dlg-slide-up 0.2s ease;
  }

  .coin-dlg__bar {
    width: calc(100% + 32px);
    margin: -14px -16px 8px;
  }

  /* 立绘缩一号：一屏里标题、两张卡、取消入口、余额+确定全都看得见 */
  .coin-dlg__mascot {
    width: 66px;
  }

  .coin-dlg__title {
    margin-bottom: 10px;
    font-size: 14.5px;
  }

  .coin-dlg__cards {
    gap: 10px;
  }
}

@keyframes coin-dlg-slide-up {
  from {
    transform: translateY(24px);
    opacity: 0.4;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@media screen and (prefers-reduced-motion: reduce) {
  .coin-dlg-mask,
  .coin-dlg {
    animation: none;
  }

  .coin-dlg__card,
  .coin-dlg__cancel,
  .coin-dlg__submit,
  .coin-dlg__close {
    transition-duration: 0.01ms !important;
  }
}
</style>
