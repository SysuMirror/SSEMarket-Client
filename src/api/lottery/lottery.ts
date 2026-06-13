import { requestFunc } from '../req'

export type LotteryMode = 'random' | 'wish'
export type LotteryStatus = 'active' | 'drawn' | 'closed'

export interface LotteryPrize {
  prizeID: number
  name: string
  quantity: number
  wishKeyword: string
  participantCount?: number
  participated?: boolean
}

export interface LotteryWinner {
  userID: number
  userName: string
  prizeID: number
  prizeName: string
}

export interface LotteryDetail {
  lotteryID: number
  postID: number
  mode: LotteryMode
  status: LotteryStatus
  drawAt: string
  drawnAt: string
  participantCount: number
  participated: boolean
  prizes: LotteryPrize[]
  winners: LotteryWinner[]
}

export interface LotteryPrizeInput {
  name: string
  quantity: number
  wishKeyword?: string
}

async function parseResponse<T>(res: Response): Promise<T | null> {
  const json = await res.json()
  if (!res.ok || json.code !== 200)
    return null
  return json.data as T
}

export async function createLotteryPost(params: {
  title: string
  content: string
  partition: string
  userTelephone: string
  mode: LotteryMode
  drawAt: string
  prizes: LotteryPrizeInput[]
  isPrivate?: boolean
}): Promise<{ ok: boolean, msg: string, postID?: number }> {
  const res = await requestFunc('/auth/lottery/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: params,
  }, true)
  if (!res)
    return { ok: false, msg: '请求失败' }
  const json = await res.json()
  const data = json.data as { postID?: number } | undefined
  return {
    ok: json.code === 200,
    msg: json.msg || (json.code === 200 ? '抽奖帖创建成功' : '创建失败'),
    postID: data?.postID,
  }
}

export async function getLotteryDetail(postID: number, userTelephone: string): Promise<LotteryDetail | null> {
  const res = await requestFunc('/auth/lottery/detail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { postID, userTelephone },
  }, true)
  if (!res)
    return null
  const json = await res.json()
  if (json.code !== 200 || json.data?.isLottery === false)
    return null
  return json.data as LotteryDetail
}

export async function participateLottery(postID: number, userTelephone: string): Promise<{ ok: boolean, msg: string }> {
  const res = await requestFunc('/auth/lottery/participate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { postID, userTelephone },
  }, true)
  if (!res)
    return { ok: false, msg: '请求失败' }
  const json = await res.json()
  return { ok: json.code === 200, msg: json.msg || (json.code === 200 ? '参与成功' : '参与失败') }
}

export async function checkLotteryParticipated(postID: number, userTelephone: string): Promise<boolean> {
  const res = await requestFunc('/auth/lottery/checkParticipated', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { postID, userTelephone },
  }, true)
  if (!res)
    return false
  const data = await parseResponse<{ participated: boolean }>(res)
  return data?.participated ?? false
}
