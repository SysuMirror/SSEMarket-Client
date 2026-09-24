/**
 * 日报人工倾向 —— 灰度开关与接口地址（2026-09-22 spec）。
 *
 * 全量上线前由 VITE_DIGEST_PREF_ENABLED（编译开关）+ 账号白名单控制可见性；
 * 调试体验：控制台执行 localStorage.setItem('digestPref.force', '1') 后刷新即可，无需重建。
 * 服务端另有权威白名单（DIGEST_PREF_ADMINS env），此处只管入口可见性。
 */
export const DIGEST_PREF_ADMINS: string[] = ['Rimuru']

export function isDigestPrefEnabled(username: string): boolean {
  if (import.meta.env.VITE_DIGEST_PREF_ENABLED !== 'true')
    return false
  if (DIGEST_PREF_ADMINS.includes(username))
    return true
  try {
    return localStorage.getItem('digestPref.force') === '1'
  }
  catch {
    return false
  }
}

export function digestPrefBaseUrl(): string {
  return import.meta.env.VITE_DIGEST_PREF_BASE_URL || '/api/v1/digest-pref'
}
