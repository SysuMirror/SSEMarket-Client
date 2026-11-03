import { requestFunc } from './req'

export type RecommendationMode = 'auto' | 'on' | 'off'
export type RecommendationEffective = 'time' | 'recommend'

export interface RecommendationSettings {
  mode: RecommendationMode
  effective: RecommendationEffective
  grayMatched: boolean
  available: boolean
  reason?: string
}

interface ApiEnvelope<T> {
  code?: number
  msg?: string
  data?: T
}

async function readEnvelope<T>(res: Response | null): Promise<T | null> {
  if (!res || !res.ok)
    return null
  try {
    const body = await res.json() as ApiEnvelope<T>
    if (body.code !== undefined && body.code !== 200)
      return null
    return body.data ?? null
  }
  catch {
    return null
  }
}

/** 读取当前用户的推荐设置（含灰度命中与实际生效模式）。 */
export async function getRecommendationSettings(): Promise<RecommendationSettings | null> {
  try {
    const res = await requestFunc('/auth/recommendation/settings', {
      method: 'GET',
      headers: {},
    }, true)
    const data = await readEnvelope<{ settings: RecommendationSettings }>(res)
    return data?.settings ?? null
  }
  catch (e) {
    console.error('getRecommendationSettings', e)
    return null
  }
}

/** 保存推荐模式：auto=跟随默认/灰度，on=开启，off=关闭。 */
export async function setRecommendationMode(mode: RecommendationMode): Promise<RecommendationSettings | null> {
  try {
    const res = await requestFunc('/auth/recommendation/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { mode },
    }, true)
    const data = await readEnvelope<{ settings: RecommendationSettings }>(res)
    return data?.settings ?? null
  }
  catch (e) {
    console.error('setRecommendationMode', e)
    return null
  }
}

/**
 * 标记帖子已读：点进详情时调用（dwellMS 不传即 0）。
 * 后续接入计时器时可传停留毫秒数，同帖只保留最大值。
 */
export async function reportRecommendationRead(postID: number, dwellMS = 0): Promise<boolean> {
  try {
    const res = await requestFunc('/auth/recommendation/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { postID, dwellMS: Math.max(0, Math.round(dwellMS)) },
    }, true)
    return !!res?.ok
  }
  catch {
    return false
  }
}