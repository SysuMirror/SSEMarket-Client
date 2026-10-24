<script setup lang="ts">
import type { CoinLedgerItem, CoinSummary } from '@/api/coin/coin'
import { Icon } from '@iconify/vue'
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { getCoinLedger, getCoinSummary } from '@/api/coin/coin'
import { showMsg } from '@/components/MessageBox'
import { setTitle } from '@/utils/title'

defineOptions({ name: 'CoinView' })

const summary = ref<CoinSummary | null>(null)
const ledger = ref<CoinLedgerItem[]>([])
const ledgerTotal = ref(0)
const loading = ref(true)
const ledgerLoading = ref(false)

const ledgerLimit = 20

setTitle('币中心')

function formatTime(iso: string) {
  if (!iso)
    return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime()))
    return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function taskProgressText(progress: number, target: number) {
  if (target >= 1800)
    return `${Math.floor(progress / 60)} / ${target / 60} 分钟`
  if (target >= 1000)
    return `${progress} / ${target} 字`
  return `${progress} / ${target}`
}

async function loadAll() {
  loading.value = true
  const [s, l] = await Promise.all([getCoinSummary(), getCoinLedger(ledgerLimit, 0)])
  summary.value = s
  ledger.value = l.items
  ledgerTotal.value = l.total
  loading.value = false
  if (!s)
    showMsg('获取币信息失败，请稍后重试')
}

async function loadMoreLedger() {
  if (ledgerLoading.value || ledger.value.length >= ledgerTotal.value)
    return
  ledgerLoading.value = true
  const l = await getCoinLedger(ledgerLimit, ledger.value.length)
  ledger.value = [...ledger.value, ...l.items]
  ledgerTotal.value = l.total
  ledgerLoading.value = false
}

onMounted(() => {
  loadAll()
})
</script>

<template>
  <div class="coin-zone">
    <header class="coin-page__top">
      <RouterLink class="coin-page__back" to="/ranking">
        <Icon icon="tabler:chevron-left" width="18" height="18" aria-hidden="true" />
        <span>排行榜</span>
      </RouterLink>
      <div class="coin-page__brand">
        <Icon icon="tabler:coin" width="18" height="18" aria-hidden="true" />
        <span>币中心</span>
      </div>
      <button type="button" class="coin-page__refresh" :disabled="loading" @click="loadAll">
        <Icon icon="tabler:refresh" width="15" height="15" aria-hidden="true" />
      </button>
    </header>

    <p v-if="loading" class="coin-page__loading">
      加载中…
    </p>

    <template v-else>
      <section class="coin-page__stats">
        <div class="coin-page__stat">
          <span class="coin-page__stat-label">币余额</span>
          <strong class="coin-page__stat-value coin-page__stat-value--coin">{{ summary?.coins ?? 0 }}</strong>
          <span class="coin-page__stat-sub">今日 {{ summary?.day ?? '' }}</span>
        </div>
        <div class="coin-page__stat">
          <span class="coin-page__stat-label">累计投出</span>
          <strong class="coin-page__stat-value">{{ summary?.thrownTotal ?? 0 }}</strong>
          <span class="coin-page__stat-sub">换来 {{ summary?.thrownExp ?? 0 }} 主页经验</span>
        </div>
        <div class="coin-page__stat">
          <span class="coin-page__stat-label">累计收到</span>
          <strong class="coin-page__stat-value">{{ summary?.received ?? 0 }}</strong>
          <span class="coin-page__stat-sub">发帖 / 阅读 / 写作 / 评分 / 投币分成</span>
        </div>
      </section>

      <section class="coin-page__card">
        <h2 class="coin-page__title">
          <Icon icon="tabler:checklist" width="15" height="15" aria-hidden="true" />
          今天怎么赚币
        </h2>
        <ul class="coin-page__tasks">
          <li
            v-for="t in summary?.tasks ?? []"
            :key="t.event"
            class="coin-page__task"
            :class="{ 'coin-page__task--done': t.done }"
          >
            <span class="coin-page__task-label">{{ t.label }}</span>
            <span class="coin-page__task-progress">
              {{ t.done ? '已完成' : taskProgressText(t.progress, t.target) }}
            </span>
            <span class="coin-page__task-reward">+{{ t.reward }} 币</span>
          </li>
        </ul>
        <p class="coin-page__note">
          投币：给帖子或小说投币，每人对每个内容最多 2 币（历史投票已折算为已投的币）；
          每投 1 币自己 +10 主页经验。币与小说的经验 / 积分是两条独立的线，不能互相兑换。
        </p>
      </section>

      <section class="coin-page__card">
        <h2 class="coin-page__title">
          <Icon icon="tabler:list-details" width="15" height="15" aria-hidden="true" />
          币流水
          <span class="coin-page__title-n">{{ ledgerTotal }}</span>
        </h2>
        <ul v-if="ledger.length > 0" class="coin-page__ledger">
          <li v-for="l in ledger" :key="l.ledgerID" class="coin-page__ledger-item">
            <span class="coin-page__ledger-label">{{ l.label }}</span>
            <span class="coin-page__ledger-time">{{ formatTime(l.createdAt) }}</span>
            <span class="coin-page__ledger-amount" :class="{ 'coin-page__ledger-amount--neg': l.amount < 0 }">
              {{ l.amount > 0 ? `+${l.amount}` : l.amount }}
            </span>
          </li>
        </ul>
        <p v-else class="coin-page__empty">
          还没有币流水
        </p>
        <button
          v-if="ledger.length > 0 && ledger.length < ledgerTotal"
          type="button"
          class="coin-page__more"
          :disabled="ledgerLoading"
          @click="loadMoreLedger"
        >
          {{ ledgerLoading ? '加载中…' : `显示更多（还有 ${ledgerTotal - ledger.length} 条）` }}
        </button>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.coin-zone {
  max-width: 720px;
  margin: 0 auto;
  padding: 10px 12px 24px;
}

.coin-page__top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.coin-page__back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #475569);
  text-decoration: none;

  &:hover {
    background: var(--color-card, #fff);
  }
}

.coin-page__brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 800;
  color: var(--color-text, #1e293b);
}

.coin-page__refresh {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  padding: 6px 8px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 8px;
  background: var(--color-card, #fff);
  color: var(--color-text-secondary, #475569);
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
  }
}

.coin-page__loading,
.coin-page__empty {
  font-size: 13px;
  color: var(--color-text-secondary, #475569);
}

.coin-page__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.coin-page__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: var(--radius-lg, 8px);
  background: var(--color-card, #fff);
  box-shadow: var(--color-card-shadow);
}

.coin-page__stat-label {
  font-size: 11px;
  color: var(--color-text-secondary, #475569);
}

.coin-page__stat-value {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-text, #1e293b);

  &--coin {
    color: #b45309;
  }
}

.coin-page__stat-sub {
  font-size: 11px;
  color: var(--color-text-secondary, #475569);
}

.coin-page__card {
  margin-bottom: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-lg, 8px);
  background: var(--color-card, #fff);
  box-shadow: var(--color-card-shadow);
}

.coin-page__title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 800;
  color: var(--color-text, #1e293b);
}

.coin-page__title-n {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary, #475569);
}

.coin-page__tasks {
  list-style: none;
  margin: 0;
  padding: 0;
}

.coin-page__task {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border, rgba(71, 85, 105, 0.08));
  font-size: 12px;

  &:last-child {
    border-bottom: none;
  }
}

.coin-page__task-label {
  color: var(--color-text, #1e293b);
}

.coin-page__task-progress {
  color: var(--color-text-secondary, #475569);
}

.coin-page__task-reward {
  font-weight: 700;
  color: #b45309;
}

.coin-page__task--done {
  .coin-page__task-label {
    color: var(--color-text-secondary, #475569);
    text-decoration: line-through;
  }

  .coin-page__task-reward {
    opacity: 0.5;
  }
}

.coin-page__note {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--accent-soft, rgba(44, 61, 86, 0.08));
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-secondary, #475569);
}

.coin-page__ledger {
  list-style: none;
  margin: 0;
  padding: 0;
}

.coin-page__ledger-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px solid var(--color-border, rgba(71, 85, 105, 0.08));
  font-size: 12px;

  &:last-child {
    border-bottom: none;
  }
}

.coin-page__ledger-label {
  color: var(--color-text, #1e293b);
}

.coin-page__ledger-time {
  color: var(--color-text-secondary, #475569);
  font-size: 11px;
}

.coin-page__ledger-amount {
  font-weight: 700;
  color: #15803d;

  &--neg {
    color: #b91c1c;
  }
}

.coin-page__more {
  margin-top: 8px;
  width: 100%;
  padding: 8px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 8px;
  background: var(--color-card, #fff);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #475569);
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
  }
}
</style>
