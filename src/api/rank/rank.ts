import { requestFunc } from '../req'

/**
 * 排行榜（投币口径）。
 *
 * 投票功能已下线：帖子榜按「真实投币数 + 历史投票数」排，
 * 作者榜按「自己帖子与小说收到的币数」排。
 */

export interface PostCoinRankItem {
  postID: number
  title: string
  partition: string
  coinNum: number
  postTime: string
}

export interface UserCoinRankItem {
  userID: number
  userName: string
  avatarURL: string
  receivedCoins: number
}

async function parseRanking(res: Response | null): Promise<Record<string, unknown>[]> {
  if (!res)
    return []
  const json = await res.json()
  if (!res.ok || json.code !== 200)
    return []
  return Array.isArray(json.data?.ranking) ? json.data.ranking : []
}

export async function getPostCoinRanking(): Promise<PostCoinRankItem[]> {
  const res = await requestFunc('/auth/postRanking', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  }, true)
  const ranking = await parseRanking(res)
  return ranking.map(r => ({
    postID: Number(r.postID) || 0,
    title: String(r.title ?? ''),
    partition: String(r.partition ?? ''),
    coinNum: Number(r.coinNum) || 0,
    postTime: String(r.postTime ?? ''),
  }))
}

export async function getUserCoinRanking(): Promise<UserCoinRankItem[]> {
  const res = await requestFunc('/auth/userRanking', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  }, true)
  const ranking = await parseRanking(res)
  return ranking.map(u => ({
    userID: Number(u.userID) || 0,
    userName: String(u.userName ?? ''),
    avatarURL: String(u.avatarURL ?? ''),
    receivedCoins: Number(u.receivedCoins) || 0,
  }))
}
