import type { AppPlatform, AppPlatformInfo } from '@/utils/appPlatform'
import { detectAppPlatform } from '@/utils/appPlatform'

/**
 * 集市 App 下载配置。
 *
 * 下载地址由构建环境注入，测试环境与生产环境各自打包各自的安装包：
 *   .env.development → 测试包    .env.production → 生产包
 * 路径分流构建也可以通过 `VITE_APP_DOWNLOAD_*` 覆盖（与其它 VITE_ 变量一致）。
 *
 * 留空表示该平台的包还没发布：按钮仍可点，提示「App 正在开发中，敬请期待」。
 */
function readDownloadURL(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

const DOWNLOAD_URLS: Partial<Record<AppPlatform, string>> = {
  android: readDownloadURL(import.meta.env.VITE_APP_DOWNLOAD_ANDROID),
  harmony: readDownloadURL(import.meta.env.VITE_APP_DOWNLOAD_HARMONY),
  windows: readDownloadURL(import.meta.env.VITE_APP_DOWNLOAD_WINDOWS),
  linux: readDownloadURL(import.meta.env.VITE_APP_DOWNLOAD_LINUX),
}

export interface AppDownloadTarget extends AppPlatformInfo {
  /** 当前环境对应平台的安装包地址；未配置为空串 */
  url: string
}

/** 结合当前浏览器与构建环境，解析出「应该下载哪个包」。 */
export function resolveAppDownload(
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  maxTouchPoints = typeof navigator === 'undefined' ? 0 : (navigator.maxTouchPoints ?? 0),
): AppDownloadTarget {
  const info = detectAppPlatform(userAgent, maxTouchPoints)
  return {
    ...info,
    url: info.supported ? (DOWNLOAD_URLS[info.platform] ?? '') : '',
  }
}

/** 触发浏览器下载（APK / EXE 直链）。 */
export function triggerAppDownload(url: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = ''
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
}