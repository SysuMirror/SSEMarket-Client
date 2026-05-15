import { useUserStore } from '@/store/userStore'

/** 主站用户 JWT；可选 `VITE_OPSAGENT_API_TOKEN` 作为 X-API-Token（与网关/非用户链并存时使用）。 */
export function opsagentAuthHeaders(): Record<string, string> {
  const userStore = useUserStore()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${userStore.token.value || ''}`,
  }
  const apiToken = (import.meta.env.VITE_OPSAGENT_API_TOKEN || '').trim()
  if (apiToken)
    headers['X-API-Token'] = apiToken
  return headers
}
