import { requestFunc } from '../req'

export interface VoteSearchPost {
  postID: number
  title: string
  partition: string
  postTime: string
  voteCount: number
}

export interface VoteRankItem {
  postID: number
  title: string
  partition: string
  voteCount: number
  postTime: string
}

async function parseResponse<T>(res: Response): Promise<T | null> {
  const json = await res.json()
  if (!res.ok || json.code !== 200)
    return null
  return json.data as T
}

export async function searchPostsByTitle(keyword: string, userTelephone: string): Promise<VoteSearchPost[]> {
  const res = await requestFunc('/auth/searchPostsByTitle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { keyword, userTelephone },
  }, true)
  if (!res)
    return []
  const data = await parseResponse<{ posts: VoteSearchPost[] }>(res)
  if (!data?.posts)
    return []
  return data.posts.map(p => ({
    postID: p.postID,
    title: p.title,
    partition: p.partition,
    postTime: p.postTime,
    voteCount: p.voteCount,
  }))
}

export async function submitVote(postID: number, userTelephone: string): Promise<{ ok: boolean, msg: string }> {
  const res = await requestFunc('/auth/submitVote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { postID, userTelephone },
  }, true)
  if (!res) {
    return { ok: false, msg: '请求失败' }
  }
  const json = await res.json()
  return { ok: json.code === 200, msg: json.msg || (json.code === 200 ? '投票成功' : '投票失败') }
}

export interface UserRankItem {
  userID: number
  userName: string
  avatarURL: string
  receivedLikeNum: number
  receivedVoteNum: number
  rankScore: number
}

/** 跳转投票页，可预填标题 */
export function votePageRoute(title?: string) {
  if (title?.trim())
    return { path: '/vote', query: { title: title.trim() } }
  return { path: '/vote' }
}

export async function getPostRanking(): Promise<VoteRankItem[]> {
  const res = await requestFunc('/auth/postRanking', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  }, true)
  if (!res)
    return []
  const data = await parseResponse<{ ranking: VoteRankItem[] }>(res)
  if (!data?.ranking)
    return []
  return data.ranking.map(r => ({
    postID: r.postID,
    title: r.title,
    partition: r.partition,
    voteCount: r.voteCount,
    postTime: r.postTime,
  }))
}

export async function getUserRanking(): Promise<UserRankItem[]> {
  const res = await requestFunc('/auth/userRanking', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  }, true)
  if (!res)
    return []
  const data = await parseResponse<{ ranking: UserRankItem[] }>(res)
  if (!data?.ranking)
    return []
  return data.ranking.map(u => ({
    userID: u.userID,
    userName: u.userName,
    avatarURL: u.avatarURL,
    receivedLikeNum: u.receivedLikeNum,
    receivedVoteNum: u.receivedVoteNum,
    rankScore: u.rankScore,
  }))
}

export async function checkUserVoted(postID: number, userTelephone: string): Promise<boolean> {
  const res = await requestFunc('/auth/checkUserVoted', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { postID, userTelephone },
  }, true)
  if (!res)
    return false
  const data = await parseResponse<{ voted: boolean }>(res)
  return data?.voted ?? false
}
