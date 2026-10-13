import { num, str } from '../novel/request'
import { requestFunc } from '../req'

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

/**
 * 取消投币：撤回我在该内容上投着的全部币（退币 + 回退经验）。
 * result.coins 是退回的币数，result.total 是取消后我还投着的币
 * （帖子可能剩历史投票折算的，小说恒为 0）。
 */
export async function cancelCoin(
  targetType: CoinTargetType,
  targetID: number,
): Promise<{ ok: boolean, msg: string, result: CoinThrowResult | null }> {
  try {
    const res = await requestFunc('/auth/coin/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { targetType, targetID },
    }, true)
    if (!res)
      return { ok: false, msg: '取消失败，请稍后重试', result: null }
    const json = await res.json()
    if (json.code !== 200)
      return { ok: false, msg: json.msg || '取消失败', result: null }
    const d = json.data ?? {}
    return {
      ok: true,
      msg: json.msg || '已取消投币',
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
    return { ok: false, msg: '取消失败，请稍后重试', result: null }
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
 * 每日进入网页 +1 币：登录状态下每次进站点都上报一次。
 *
 * 「今天有没有领过」完全由后端记录（coin_ledger 的幂等键 = 用户 + 事件 + 日期），
 * 前端不做任何本地缓存判断 —— 之前用 localStorage 记日期，同一浏览器切换账号后
 * 新账号会被旧记录短路，领不到当天的币。已登录的调用方（App.vue）只在挂载 /
 * 登录成功时各调一次，请求量很小；后端对重复上报返回 granted=0。
 */
export async function reportDailyVisit(): Promise<{ granted: number, coins: number } | null> {
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
    return { granted: num(json.data?.granted), coins: num(json.data?.coins) }
  }
  catch (e) {
    console.error(e)
    return null
  }
}
