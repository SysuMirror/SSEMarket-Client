import { ensureAccessToken } from '@/api/req'
import { digestPrefBaseUrl } from '@/config/digestPref'
import { useUserStore } from '@/store/userStore'

export interface DigestPrefData {
  mode: 'default' | 'prefer'
  text: string
  updated_at: string
  updated_by: string
  daily_post_id: number | null
}

async function authHeaders(): Promise<Record<string, string>> {
  await ensureAccessToken()
  const store = useUserStore()
  return {
    Authorization: `Bearer ${store.token.value || ''}`,
    'Content-Type': 'application/json',
  }
}

/** 读当前倾向。失败返回 null（调用方展示默认态）。 */
export async function getDigestPref(): Promise<DigestPrefData | null> {
  try {
    const res = await fetch(digestPrefBaseUrl(), { method: 'GET', headers: await authHeaders() })
    if (!res.ok)
      return null
    return (await res.json()) as DigestPrefData
  }
  catch {
    return null
  }
}

/** 保存倾向。返回 null=成功，否则错误文案。 */
export async function saveDigestPref(mode: 'default' | 'prefer', text: string): Promise<string | null> {
  try {
    const res = await fetch(digestPrefBaseUrl(), {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ mode, text }),
    })
    if (!res.ok) {
      const detail = (await res.text()).trim()
      return detail && detail.length < 200 ? detail : `保存失败（${res.status}）`
    }
    return null
  }
  catch (e) {
    return `保存失败：${e instanceof Error ? e.message : '网络错误'}`
  }
}
