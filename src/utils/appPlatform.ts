/**
 * 集市 App 的终端识别。
 *
 * 目前发布 Android / Windows / Linux 三个版本：
 * - 手机端：Android 可下载，iOS 及其他手机系统提示「暂未提供」；
 *   老版鸿蒙 UA 带 Android 标记，会走 Android 包；鸿蒙 NEXT 的 HAP 还未签名，暂不提供。
 * - 桌面端：Windows、Linux 可下载，macOS 及其他桌面系统提示「暂未提供」。
 *
 * 只做 UA 判断，不依赖浏览器 API，方便 Node 里直接跑单测。
 */
export type AppPlatform = 'android' | 'harmony' | 'windows' | 'ios' | 'macos' | 'linux' | 'other'

export type AppDevice = 'mobile' | 'desktop'

export interface AppPlatformInfo {
  platform: AppPlatform
  device: AppDevice
  /** 展示给用户的系统名 */
  label: string
  /** 是否有对应平台的安装包（与是否已配置下载地址无关） */
  supported: boolean
}

const LABELS: Record<AppPlatform, string> = {
  android: 'Android',
  harmony: '鸿蒙',
  windows: 'Windows',
  ios: 'iOS',
  macos: 'macOS',
  linux: 'Linux',
  other: '当前系统',
}

const SUPPORTED: Record<AppPlatform, boolean> = {
  android: true,
  // HAP 目前是未签名包，普通用户装不了，等签名后再打开。
  harmony: false,
  windows: true,
  ios: false,
  macos: false,
  linux: true,
  other: false,
}

/**
 * 按 UA 判断终端平台。
 *
 * @param userAgent navigator.userAgent
 * @param maxTouchPoints 用于区分 iPadOS 13+ 的桌面 UA（iPad 会伪装成 Macintosh，但有触屏）
 */
export function detectAppPlatform(userAgent: string, maxTouchPoints = 0): AppPlatformInfo {
  const ua = userAgent || ''
  let platform: AppPlatform

  // 鸿蒙 NEXT 的 UA 含 OpenHarmony，走鸿蒙包；老版鸿蒙仍带 Android 标记，
  // 直接装 Android 包即可，所以先判 Android 再判 HarmonyOS。
  if (/OpenHarmony/i.test(ua))
    platform = 'harmony'
  else if (/Android/i.test(ua))
    platform = 'android'
  else if (/HarmonyOS/i.test(ua))
    platform = 'harmony'
  else if (/iPhone|iPad|iPod/i.test(ua))
    platform = 'ios'
  else if (/Macintosh/i.test(ua) && maxTouchPoints > 1)
    platform = 'ios'
  else if (/Windows/i.test(ua))
    platform = 'windows'
  else if (/Mac OS X|Macintosh/i.test(ua))
    platform = 'macos'
  else if (/Linux/i.test(ua))
    platform = 'linux'
  else
    platform = 'other'

  let device: AppDevice
  if (platform === 'android' || platform === 'harmony' || platform === 'ios')
    device = 'mobile'
  else if (platform === 'other')
    device = /Mobile|Mobi/i.test(ua) ? 'mobile' : 'desktop'
  else
    device = 'desktop'

  return {
    platform,
    device,
    label: LABELS[platform],
    supported: SUPPORTED[platform],
  }
}