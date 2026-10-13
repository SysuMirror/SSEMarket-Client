import { requestFunc } from '../req'

export function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function str(v: unknown): string {
  return v == null ? '' : String(v)
}

export function bool(v: unknown): boolean {
  return Boolean(v)
}

/** 小说接口统一走 POST + Bearer；失败或异常返回 null，由调用方决定回退值。 */
export async function novelPostJSON(url: string, body: object): Promise<Record<string, unknown> | null> {
  try {
    const res = await requestFunc(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }, true)
    if (!res?.ok)
      return null
    return await res.json() as Record<string, unknown>
  }
  catch (e) {
    console.error(e)
    return null
  }
}

/** 需要读取后端 msg（如「已加入书架」）时使用：保留状态码与响应体。 */
export async function novelPostRaw(url: string, body: object): Promise<{ ok: boolean, status: number, data: Record<string, unknown> } | null> {
  try {
    const res = await requestFunc(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }, true)
    if (!res)
      return null
    let data: Record<string, unknown> = {}
    try {
      data = await res.json() as Record<string, unknown>
    }
    catch {
      data = {}
    }
    return { ok: res.ok, status: res.status, data }
  }
  catch (e) {
    console.error(e)
    return null
  }
}
