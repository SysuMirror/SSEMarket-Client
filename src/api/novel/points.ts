import type {
  NovelCheckInResult,
  NovelLedgerItem,
  NovelPointsEvent,
  NovelPointsSummary,
} from './types'
import { novelPostJSON, num, str } from './request'

function normalizeEvent(raw: unknown): NovelPointsEvent {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    event: str(r.event),
    label: str(r.label),
    currency: str(r.currency),
    amount: num(r.amount),
  }
}

function normalizeLedgerItem(raw: unknown): NovelLedgerItem {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    ledgerID: num(r.ledgerID),
    novelID: num(r.novelID),
    event: str(r.event),
    label: str(r.label),
    currency: str(r.currency),
    amount: num(r.amount),
    settledValue: num(r.settledValue),
    createdAt: str(r.createdAt),
  }
}

/** 我的经验 / 作者积分总览。失败返回 null。 */
export async function getNovelPointsSummary(): Promise<NovelPointsSummary | null> {
  const data = await novelPostJSON('/auth/novel/points/summary', {})
  if (!data)
    return null
  const byEvent = Array.isArray(data.byEvent) ? data.byEvent as unknown[] : []
  return {
    experience: num(data.experience),
    pointsFen: num(data.pointsFen),
    pointsScore: num(data.pointsScore),
    todayExp: num(data.todayExp),
    checkInDay: str(data.checkInDay),
    checkInStreak: num(data.checkInStreak),
    byEvent: byEvent.map(normalizeEvent),
  }
}

/** 我的积分 / 经验流水（分页）。 */
export async function getNovelLedger(
  limit = 30,
  offset = 0,
): Promise<{ items: NovelLedgerItem[], total: number }> {
  const data = await novelPostJSON('/auth/novel/points/ledger', { limit, offset })
  const list = Array.isArray(data?.items) ? data.items as unknown[] : []
  return { items: list.map(normalizeLedgerItem), total: num(data?.total) }
}

/** 每日签到：每天一次，重复签到不重复发放（already=true）。 */
export async function novelCheckIn(): Promise<NovelCheckInResult | null> {
  const body = await novelPostJSON('/auth/novel/points/checkin', {})
  if (!body)
    return null
  // 该接口走 response.Response 包装：{code, data:{...}, msg}
  const payload = (body.data ?? {}) as Record<string, unknown>
  return {
    amount: num(payload.amount),
    streak: num(payload.streak),
    day: str(payload.day),
    already: Boolean(payload.already),
  }
}

// 打赏已下线（被投币体系替换，见 @/api/coin/coin 与 books.ts 的 rateNovel）。
