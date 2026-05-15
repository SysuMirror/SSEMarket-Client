/**
 * 卸载历史上错误部署在 /new/ 下的 Workbox SW（与当前构建无 sw.js 冲突时会报 non-precached-url）。
 * 仅匹配 workbox 或 /new/ 下的 sw.js，避免影响主站其它路径的 Service Worker。
 */
export async function clearStaleNewSSEServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator))
    return
  if (!location.pathname.startsWith('/new'))
    return
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    for (const r of regs) {
      const sw = r.active ?? r.waiting ?? r.installing
      const scriptURL = sw?.scriptURL ?? ''
      if (scriptURL.includes('workbox') || scriptURL.includes('/new/sw.js')) {
        await r.unregister()
      }
    }
  }
  catch {
    // ignore
  }
}
