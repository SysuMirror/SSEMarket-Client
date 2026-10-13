<script lang="ts" setup>
import type { NovelLedgerItem, NovelPointsEvent, NovelPointsSummary } from '@/api/novel/types'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { getNovelLedger, getNovelPointsSummary, novelCheckIn } from '@/api/novel'
import { showMsg } from '@/components/MessageBox'
import { formatNovelTime } from '@/utils/novelText'
import { setTitle } from '@/utils/title'

defineOptions({ name: 'NovelPointsView' })

const LEDGER_PAGE = 30

const summary = ref<NovelPointsSummary | null>(null)
const ledger = ref<NovelLedgerItem[]>([])
const ledgerTotal = ref(0)
const loading = ref(true)
const listBusy = ref(false)
const checkInBusy = ref(false)

const checkedInToday = computed(() => (summary.value?.checkInStreak ?? 0) > 0)
const hasMore = computed(() => ledger.value.length < ledgerTotal.value)

/** 积分以「分」记账（1 积分 = 10 分），展示时换算成积分。 */
function formatScore(fen: number): string {
  const score = fen / 10
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

function formatAmount(item: NovelLedgerItem | NovelPointsEvent): string {
  const sign = item.amount > 0 ? '+' : ''
  if (item.currency === 'point')
    return `${sign}${formatScore(item.amount)} 积分`
  return `${sign}${item.amount} 经验`
}

async function loadSummary() {
  summary.value = await getNovelPointsSummary()
}

async function loadLedger(reset: boolean) {
  if (listBusy.value)
    return
  listBusy.value = true
  const offset = reset ? 0 : ledger.value.length
  const result = await getNovelLedger(LEDGER_PAGE, offset)
  ledger.value = reset ? result.items : [...ledger.value, ...result.items]
  ledgerTotal.value = result.total
  listBusy.value = false
}

async function loadAll() {
  loading.value = true
  await Promise.all([loadSummary(), loadLedger(true)])
  loading.value = false
}

async function onCheckIn() {
  if (checkInBusy.value)
    return
  checkInBusy.value = true
  const result = await novelCheckIn()
  checkInBusy.value = false
  if (!result) {
    showMsg('签到失败，请稍后重试')
    return
  }
  if (result.already) {
    showMsg('今天已经签到过了')
  }
  else {
    showMsg(`签到成功 +${result.amount} 经验（连续 ${result.streak} 天）`)
  }
  await Promise.all([loadSummary(), loadLedger(true)])
}

onMounted(() => {
  setTitle('小说积分中心')
  void loadAll()
})
</script>

<template>
  <div class="novel-zone novel-points">
    <header class="novel-points__top">
      <RouterLink class="novel-points__back" to="/novel">
        <Icon icon="tabler:chevron-left" width="18" height="18" aria-hidden="true" />
        <span>小说</span>
      </RouterLink>
      <div class="novel-points__brand">
        <Icon icon="tabler:coin" width="18" height="18" aria-hidden="true" />
        <span>积分中心</span>
      </div>
      <RouterLink class="novel-points__back" to="/coin">
        <Icon icon="tabler:coin" width="18" height="18" aria-hidden="true" />
        <span>币中心</span>
      </RouterLink>
      <button type="button" class="novel-points__refresh" :disabled="loading" @click="loadAll">
        <Icon icon="tabler:refresh" width="15" height="15" aria-hidden="true" />
      </button>
    </header>

    <p v-if="loading" class="novel-points__loading">
      加载中…
    </p>

    <template v-else>
      <section class="novel-points__stats">
        <div class="novel-points__stat">
          <span class="novel-points__stat-label">我的经验</span>
          <strong class="novel-points__stat-value">{{ summary?.experience ?? 0 }}</strong>
          <span class="novel-points__stat-sub">今日 +{{ summary?.todayExp ?? 0 }}</span>
        </div>
        <div class="novel-points__stat">
          <span class="novel-points__stat-label">作者积分</span>
          <strong class="novel-points__stat-value">{{ formatScore(summary?.pointsFen ?? 0) }}</strong>
          <span class="novel-points__stat-sub">{{ summary?.pointsFen ?? 0 }} 分（1 积分 = 10 分）</span>
        </div>
        <div class="novel-points__stat">
          <span class="novel-points__stat-label">连续签到</span>
          <strong class="novel-points__stat-value">{{ summary?.checkInStreak ?? 0 }} 天</strong>
          <span class="novel-points__stat-sub">{{ checkedInToday ? '今天已签到' : '今天还没签到' }}</span>
        </div>
      </section>

      <section class="novel-points__card">
        <div class="novel-points__checkin">
          <div class="novel-points__checkin-text">
            <strong>每日签到</strong>
            <span>基础 +2 经验，连续签到每天额外 +1（加成最多 +5），每天只算一次</span>
          </div>
          <button
            type="button"
            class="novel-points__checkin-btn"
            :disabled="checkInBusy || checkedInToday"
            @click="onCheckIn"
          >
            {{ checkInBusy ? '签到中…' : checkedInToday ? '已签到' : '签到' }}
          </button>
        </div>
      </section>

      <section class="novel-points__card">
        <h2 class="novel-points__title">
          <Icon icon="tabler:list-details" width="15" height="15" aria-hidden="true" />
          积分规则
        </h2>
        <ul class="novel-points__rules">
          <li><span>阅读满 1 小时</span><em>+1 经验</em><i>按本累计，心跳单次最多计 120 秒</i></li>
          <li><span>当日阅读满 30 分钟</span><em>+2 经验</em><i>每天一次</i></li>
          <li><span>昨日也达标（连续阅读）</span><em>+2 经验</em><i>每天最多一次</i></li>
          <li><span>发表评论</span><em>+2 经验</em><i>每条评论只算一次；每人每日上限 20 经验</i></li>
          <li><span>评论被点赞</span><em>+1 经验</em><i>同一人对同一评论只算一次；单条评论上限 20</i></li>
          <li><span>被加入书架</span><em>+5 积分</em><i>同一读者同一本书只算一次</i></li>
          <li><span>新增在读读者</span><em>+0.1 积分</em><i>按本独立、UV 去重、只算一次</i></li>
          <li><span>写作每满 5000 字</span><em>+1 积分</em><i>按书字数游标结算，改文不重复计</i></li>
          <li><span>章节更新</span><em>+2 积分</em><i>每日最多计 5 章</i></li>
        </ul>
        <p class="novel-points__rules-note">
          打赏已下线，改为<RouterLink to="/coin">投币</RouterLink>：给帖子或小说投币每人最多 2 币，每投 1 币自己 +10 主页经验。经验与积分仍是两条独立的线，币不能与它们互相兑换。
        </p>
      </section>

      <section v-if="summary && summary.byEvent.length > 0" class="novel-points__card">
        <h2 class="novel-points__title">
          <Icon icon="tabler:chart-bar" width="15" height="15" aria-hidden="true" />
          按行为累计
        </h2>
        <ul class="novel-points__byevent">
          <li v-for="e in summary.byEvent" :key="e.event">
            <span class="novel-points__byevent-label">{{ e.label }}</span>
            <span class="novel-points__amount" :class="{ 'novel-points__amount--neg': e.amount < 0 }">
              {{ formatAmount(e) }}
            </span>
          </li>
        </ul>
      </section>

      <section class="novel-points__card">
        <h2 class="novel-points__title">
          <Icon icon="tabler:receipt" width="15" height="15" aria-hidden="true" />
          我的流水
          <span class="novel-points__title-meta">共 {{ ledgerTotal }} 条</span>
        </h2>

        <ul v-if="ledger.length > 0" class="novel-points__ledger">
          <li v-for="item in ledger" :key="item.ledgerID">
            <span class="novel-points__ledger-label">{{ item.label }}</span>
            <span class="novel-points__ledger-time">{{ formatNovelTime(item.createdAt) }}</span>
            <span class="novel-points__amount" :class="{ 'novel-points__amount--neg': item.amount < 0 }">
              {{ formatAmount(item) }}
            </span>
          </li>
        </ul>
        <p v-else class="novel-points__empty">
          还没有流水。读一章、发一条评论或签个到就会开始记录
        </p>

        <button v-if="hasMore" type="button" class="novel-points__more" :disabled="listBusy" @click="loadLedger(false)">
          {{ listBusy ? '加载中…' : '加载更多' }}
        </button>
      </section>
    </template>
  </div>
</template>

<style scoped lang="scss">
.novel-points {
  width: 100%;
  max-width: 720px;
  min-width: 0;
  margin: 0 auto;
  padding: 8px 10px 24px;
  box-sizing: border-box;
  overflow-x: hidden;
}

.novel-points__top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.novel-points__back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 6px 10px 6px 6px;
  border-radius: 8px;
  background: var(--color-card, #fff);
  color: var(--color-text-secondary, #475569);
  font-size: 12px;
  text-decoration: none;
}

.novel-points__brand {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent, #2c3d56);
  font-weight: 800;
  font-size: 14px;
}

.novel-points__refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--color-border, rgba(71, 85, 105, 0.12));
  border-radius: 8px;
  background: var(--color-card, #fff);
  color: var(--color-text-secondary, #475569);
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}

.novel-points__loading,
.novel-points__empty {
  margin: 0 0 12px;
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-muted, #94a3b8);
}

/* ---------------- 统计卡 ---------------- */

.novel-points__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.novel-points__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 10px;
  background: var(--color-card, #fff);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--color-card-shadow);
}

.novel-points__stat-label {
  font-size: 11px;
  color: var(--color-text-muted, #94a3b8);
}

.novel-points__stat-value {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-text, #1e293b);
}

.novel-points__stat-sub {
  font-size: 10px;
  color: var(--color-text-muted, #94a3b8);
}

/* ---------------- 通用卡片 ---------------- */

.novel-points__card {
  padding: 12px 14px;
  margin-bottom: 10px;
  background: var(--color-card, #fff);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--color-card-shadow);
}

.novel-points__title {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text, #1e293b);
}

.novel-points__title-meta {
  margin-left: auto;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted, #94a3b8);
}

/* ---------------- 签到 ---------------- */

.novel-points__checkin {
  display: flex;
  align-items: center;
  gap: 10px;
}

.novel-points__checkin-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    font-size: 13px;
    color: var(--color-text, #1e293b);
  }

  span {
    font-size: 11px;
    line-height: 1.5;
    color: var(--color-text-muted, #94a3b8);
  }
}

.novel-points__checkin-btn {
  flex-shrink: 0;
  padding: 8px 16px;
  border: none;
  border-radius: 9px;
  background: var(--accent, #2c3d56);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}

/* ---------------- 规则表 ---------------- */

.novel-points__rules {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.novel-points__rules-note {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--accent-soft, rgba(44, 61, 86, 0.08));
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-secondary, #475569);

  a {
    color: var(--accent, #2c3d56);
    font-weight: 700;
  }
}

.novel-points__rules li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 4px 8px;
  padding: 7px 0;
  border-bottom: 1px solid var(--color-border, rgba(71, 85, 105, 0.08));
  font-size: 12px;

  &:last-child {
    border-bottom: none;
  }

  span {
    color: var(--color-text, #1e293b);
  }

  em {
    font-style: normal;
    font-weight: 700;
    color: var(--accent, #2c3d56);
    white-space: nowrap;
  }

  i {
    grid-column: 1 / -1;
    font-style: normal;
    font-size: 11px;
    line-height: 1.5;
    color: var(--color-text-muted, #94a3b8);
  }
}

/* ---------------- 按行为累计 / 流水 ---------------- */

.novel-points__byevent,
.novel-points__ledger {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.novel-points__byevent li,
.novel-points__ledger li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px solid var(--color-border, rgba(71, 85, 105, 0.08));
  font-size: 12px;

  &:last-child {
    border-bottom: none;
  }
}

.novel-points__byevent-label,
.novel-points__ledger-label {
  flex: 1;
  min-width: 0;
  color: var(--color-text, #1e293b);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.novel-points__ledger-time {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--color-text-muted, #94a3b8);
}

.novel-points__amount {
  flex-shrink: 0;
  font-weight: 700;
  color: #0f766e;

  &--neg {
    color: #b91c1c;
  }
}

.novel-points__more {
  width: 100%;
  margin-top: 8px;
  padding: 8px;
  border: 1px dashed var(--color-border, rgba(71, 85, 105, 0.2));
  border-radius: 8px;
  background: transparent;
  color: var(--accent, #2c3d56);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}

@media screen and (max-width: 480px) {
  .novel-points__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
