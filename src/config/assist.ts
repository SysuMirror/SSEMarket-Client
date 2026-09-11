/**
 * 集市发帖 AI 应答 —— 灰度开关与接口地址。
 *
 * 全量上线前由 VITE_ASSIST_ENABLED（编译开关）+ 账号白名单控制可见性；
 * 调试体验：控制台执行 localStorage.setItem('assist.force', '1') 后刷新即可，无需重建。
 */
export const ASSIST_TESTER_ACCOUNTS: string[] = ['Rimuru', '秋']

export function isAssistEnabled(username: string): boolean {
  if (import.meta.env.VITE_ASSIST_ENABLED !== 'true')
    return false
  if (ASSIST_TESTER_ACCOUNTS.includes(username))
    return true
  try {
    return localStorage.getItem('assist.force') === '1'
  }
  catch {
    return false
  }
}

export function assistBaseUrl(): string {
  return import.meta.env.VITE_ASSIST_BASE_URL || '/api/v1/assist'
}
