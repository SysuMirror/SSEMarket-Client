import { requestFunc } from '../req'

/** 在线统计场景：与后端 domain/presence.go 的白名单保持一致。 */
export type PresenceScene = 'home' | 'post' | 'novel' | 'music' | 'resume'

export interface PresenceSnapshot {
  /** 站点当前在线人数（去重后的登录用户） */
  online: number
  /** 同一场景/内容上的在线人数；scene 为 home 或 targetID<=0 时为 0 */
  viewers: number
  scene: PresenceScene | ''
  targetID: number
  /** 在线判定窗口（秒） */
  windowSeconds: number
  /** 建议心跳间隔（秒） */
  heartbeatSeconds: number
}

/**
 * 上报一次保活心跳。
 * 失败返回 null（在线人数是弱功能，不影响页面本身）。
 */
export async function sendPresenceHeartbeat(
  scene: PresenceScene,
  targetID = 0,
): Promise<PresenceSnapshot | null> {
  try {
    const res = await requestFunc('/auth/presence/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: scene === 'home' ? { scene } : { scene, targetID },
    }, true)
    if (!res?.ok)
      return null
    const json = await res.json()
    if (json.code !== 200 || !json.data)
      return null
    return json.data as PresenceSnapshot
  }
  catch (e) {
    console.error('presence heartbeat failed', e)
    return null
  }
}

/** 只读取在线人数，不写入活跃记录（用于页面首次渲染前的占位刷新）。 */
export async function fetchPresenceStats(
  scene: PresenceScene,
  targetID = 0,
): Promise<PresenceSnapshot | null> {
  try {
    const res = await requestFunc('/auth/presence/stats', {
      method: 'GET',
      headers: {},
      query: scene === 'home' ? { scene } : { scene, targetID: String(targetID) },
    }, true)
    if (!res?.ok)
      return null
    const json = await res.json()
    if (json.code !== 200 || !json.data)
      return null
    return json.data as PresenceSnapshot
  }
  catch (e) {
    console.error('presence stats failed', e)
    return null
  }
}
