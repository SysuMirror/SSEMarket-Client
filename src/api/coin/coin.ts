import { requestFunc } from '../req'
import { num, str } from '../novel/request'

/**
 * 站内币体系（与小说的经验/积分完全独立，各记各的流水）。
 *
 * 赚币：每日进入网页 / 每日首次发帖 / 每日阅读满 30 分钟 /
 *       每日更新写作满 4000 字 / 收到评分。
 * 花币：给帖子或小说投币，每人对每个内容最多 2 币；
 *       每投 1 币，投币者自己 +10 主页经验（users.score）。
 */

export type CoinTargetType = 'post' | 'novel'

export interface CoinThrowResult {
  coins: number
  total: number
  exp: number
  coinsLeft: number
  targetType: string
  targetID: number
}

export interface CoinTask {
  event: string
  label: string
  target: number
  progress: number
  reward: number
  done: boolean
  available: boolean
}

export interface CoinSummary {
  coins: number
  day: string
  tasks: CoinTask[]
  thrownTotal: number
  thrownExp: number
  received: number
}

export interface CoinLedgerItem {
  ledgerID: number
  targetType: string
  targetID: number
  event: string
  label: string
  amount: number
  createdAt: string
}

/**
 * 投币。上限（每人每内容 2 币，历史投票已折算为已投的币）、扣币、
 * 加主页经验都在后端一个事务里完成；失败时返回后端 msg。
 */
export async function throwCoin(
  targetType: CoinTargetType,
  targetID: number,
  coins: number,
): Promise<{ ok: boolean, msg: string, result: CoinThrowResult | null }> {
  try {
    const res = await requestFunc('/auth/coin/throw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { targetType, targetID, coins },
    }, true)
    if (!res)
      return { ok: false, msg: '投币失败，请稍后重试', result: null }
    const json = await res.json()
    if (json.code !== 200)
      return { ok: false, msg: json.msg || '投币失败', result: null }
    const d = json.data ?? {}
    return {
      ok: true,
      msg: json.msg || '已投币',
      result: {
        coins: num(d.coins),
        total: num(d.total),
        exp: num(d.exp),
        coinsLeft: num(d.coinsLeft),
        targetType: str(d.targetType),
        targetID: num(d.targetID),
      },
    }
  }
  catch (e) {
    console.error(e)
    return { ok: false, msg: '投币失败，请稍后重试', result: null }
  }
}

/** 我的币总览：余额、今天各项任务的进度、累计投币与经验加成。 */
export async function getCoinSummary(): Promise<CoinSummary | null> {
  try {
    const res = await requestFunc('/auth/coin/summary', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }, true)
    if (!res?.ok)
      return null
    const json = await res.json()
    if (json.code !== 200 || !json.data)
      return null
    const d = json.data
    const tasks = Array.isArray(d.tasks)
      ? (d.tasks as Record<string, unknown>[]).map(t => ({
          event: str(t.event),
          label: str(t.label),
          target: num(t.target),
          progress: num(t.progress),
          reward: num(t.reward),
          done: Boolean(t.done),
          available: Boolean(t.available),
        }))
      : []
    return {
      coins: num(d.coins),
      day: str(d.day),
      tasks,
      thrownTotal: num(d.thrownTotal),
      thrownExp: num(d.thrownExp),
      received: num(d.received),
    }
  }
  catch (e) {
    console.error(e)
    return null
  }
}

/** 我的币流水（分页）。 */
export async function getCoinLedger(limit = 20, offset = 0): Promise<{ items: CoinLedgerItem[], total: number }> {
  try {
    const res = await requestFunc('/auth/coin/ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { limit, offset },
    }, true)
    if (!res?.ok)
      return { items: [], total: 0 }
    const json = await res.json()
    const list = Array.isArray(json.data?.items) ? json.data.items as Record<string, unknown>[] : []
    return {
      items: list.map(x => ({
        ledgerID: num(x.ledgerID),
        targetType: str(x.targetType),
        targetID: num(x.targetID),
        event: str(x.event),
        label: str(x.label),
        amount: num(x.amount),
        createdAt: str(x.createdAt),
      })),
      total: num(json.data?.total),
    }
  }
  catch (e) {
    console.error(e)
    return { items: [], total: 0 }
  }
}

/**
 * 每日进入网页 +1 币：进站点时上报一次即可。
 * 本地按日期短路（避免每次路由跳转都发请求），后端幂等键也含日期，双保险。
 */
const VISIT_REPORT_KEY = 'coinVisitDay'

export async function reportDailyVisit(): Promise<{ granted: number, coins: number } | null> {
  const day = new Date().toISOString().slice(0, 10)
  try {
    if (localStorage.getItem(VISIT_REPORT_KEY) === day)
      return null
  }
  catch {
    // localStorage 不可用就每次进站点报一次，后端幂等兜底
  }
  try {
    const res = await requestFunc('/auth/coin/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {},
    }, true)
    if (!res?.ok)
      return null
    const json = await res.json()
    if (json.code !== 200)
      return null
    try {
      localStorage.setItem(VISIT_REPORT_KEY, day)
    }
    catch {
      // ignore
    }
    return { granted: num(json.data?.granted), coins: num(json.data?.coins) }
  }
  catch (e) {
    console.error(e)
    return null
  }
}
