/**
 * 前端体验与质量遥测：Web Vitals、结构化前端错误、交互摩擦（Rage Click）及列表批量曝光。
 * 严格遵循隐私边界：不采集原始错误堆栈文本/用户输入/URL 查询串，并完全服从用户采集开关。
 */
import {
  connectionType,
  deviceType,
  getAppVersion,
  getCurrentRouteTemplate,
  isEviaConsentEnabled,
  onEviaConsentChange,
  trackEvia,
} from './evia'

let started = false
let consentBound = false
let vitalsFlushed = false
let errorCount = 0
const MAX_ERRORS_PER_SESSION = 20
const seenErrorHashes = new Set<string>()
let detachTelemetry: (() => void) | null = null

let lcpMs = -1
let fcpMs = -1
let clsScore = 0
let inpMs = -1
let ttfbMs = -1

/** 稳定 FNV-1a 32-bit 哈希，用于对错误消息聚合签名而不泄露敏感明文。 */
function fnv1aHash(input: string): string {
  let hash = 0x811C9DC5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function structuralElementPath(node: EventTarget | null): string {
  let element = node instanceof Element ? node : null
  const parts: string[] = []
  for (let depth = 0; element && depth < 4; depth++) {
    const tag = element.localName.toLowerCase()
    const role = element.getAttribute('role')
    const siblings = element.parentElement
      ? Array.from(element.parentElement.children).filter(c => c.localName === element!.localName)
      : [element]
    const idx = Math.max(0, siblings.indexOf(element)) + 1
    parts.unshift(role ? `${tag}[${role}]:nth-of-type(${idx})` : `${tag}:nth-of-type(${idx})`)
    element = element.parentElement
    if (element?.localName === 'body') {
      parts.unshift('body')
      break
    }
  }
  return (parts.join('>') || 'unknown').slice(0, 128)
}

function flushWebVitals(): void {
  if (vitalsFlushed || !isEviaConsentEnabled() || typeof window === 'undefined')
    return

  if (ttfbMs < 0 && typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav && Number.isFinite(nav.responseStart) && nav.responseStart >= 0)
      ttfbMs = Math.round(nav.responseStart)
  }
  if (fcpMs < 0 && typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
    const paint = performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint')
    if (paint && Number.isFinite(paint.startTime))
      fcpMs = Math.round(paint.startTime)
  }

  if (lcpMs < 0 && fcpMs < 0 && ttfbMs < 0 && inpMs < 0)
    return

  vitalsFlushed = true
  const properties: Record<string, string | number> = {
    route_template: getCurrentRouteTemplate().slice(0, 128),
    device_type: deviceType(window.innerWidth),
    connection_type: connectionType(),
    app_version: getAppVersion(),
    cls_score: Math.round(Math.min(clsScore, 100) * 1000) / 1000,
  }
  if (lcpMs >= 0)
    properties.lcp_ms = Math.min(lcpMs, 120_000)
  if (fcpMs >= 0)
    properties.fcp_ms = Math.min(fcpMs, 120_000)
  if (inpMs >= 0)
    properties.inp_ms = Math.min(inpMs, 120_000)
  if (ttfbMs >= 0)
    properties.ttfb_ms = Math.min(ttfbMs, 120_000)

  trackEvia('web_vitals_reported', properties)
}

function recordError(errorType: 'runtime' | 'promise' | 'resource', name: string, message: string): void {
  if (!isEviaConsentEnabled() || errorCount >= MAX_ERRORS_PER_SESSION)
    return
  const safeName = (name || 'Error').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 64)
  const routeTemplate = getCurrentRouteTemplate().slice(0, 128)
  const hash = fnv1aHash(`${errorType}:${safeName}:${message.slice(0, 200)}:${routeTemplate}`)
  if (seenErrorHashes.has(hash))
    return
  seenErrorHashes.add(hash)
  errorCount += 1
  trackEvia('js_error_occurred', {
    error_type: errorType,
    error_name: safeName,
    message_hash: hash,
    route_template: routeTemplate,
    app_version: getAppVersion(),
  })
}

export function stopTelemetryObservers(): void {
  started = false
  detachTelemetry?.()
  detachTelemetry = null
}

export function initTelemetryObservers(): void {
  if (!consentBound) {
    consentBound = true
    onEviaConsentChange((allowed) => {
      if (!allowed)
        stopTelemetryObservers()
      else
        initTelemetryObservers()
    })
  }
  if (started || !isEviaConsentEnabled() || typeof window === 'undefined' || typeof document === 'undefined')
    return
  started = true

  const observers: PerformanceObserver[] = []
  if (typeof PerformanceObserver !== 'undefined') {
    const observe = (type: string, handler: (entries: PerformanceEntryList) => void) => {
      try {
        const obs = new PerformanceObserver(list => handler(list.getEntries()))
        obs.observe({ type, buffered: true })
        observers.push(obs)
      }
      catch {
        // 不支持该 PerformanceEntry 类型时静默降级
      }
    }

    observe('largest-contentful-paint', (entries) => {
      const last = entries[entries.length - 1]
      if (last && Number.isFinite(last.startTime))
        lcpMs = Math.round(last.startTime)
    })

    observe('paint', (entries) => {
      for (const entry of entries) {
        if (entry.name === 'first-contentful-paint' && Number.isFinite(entry.startTime))
          fcpMs = Math.round(entry.startTime)
      }
    })

    observe('layout-shift', (entries) => {
      for (const entry of entries as (PerformanceEntry & { hadRecentInput?: boolean, value?: number })[]) {
        if (!entry.hadRecentInput && typeof entry.value === 'number' && Number.isFinite(entry.value))
          clsScore += entry.value
      }
    })

    observe('event', (entries) => {
      for (const entry of entries) {
        if (Number.isFinite(entry.duration) && entry.duration > inpMs)
          inpMs = Math.round(entry.duration)
      }
    })
  }

  // 稳定后 8 秒自动上报一次首屏 Web Vitals，也在隐藏/离开前兜底 flush
  const vitalsTimer = window.setTimeout(() => flushWebVitals(), 8000)

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden')
      flushWebVitals()
  }
  const onPageHide = () => flushWebVitals()

  const onError = (event: ErrorEvent) => {
    const target = event.target
    if (target && target !== window && target instanceof Element) {
      const tag = target.localName.toLowerCase()
      if (tag === 'script' || tag === 'link')
        recordError('resource', `${tag}_load_error`, target.getAttribute('src') || target.getAttribute('href') || tag)
      return
    }
    const err = event.error as Error | undefined
    recordError('runtime', err?.name || 'Error', err?.message || event.message || 'unknown')
  }

  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason
    const name = reason instanceof Error ? reason.name : typeof reason
    const msg = reason instanceof Error ? reason.message : String(reason ?? 'rejected')
    recordError('promise', name || 'UnhandledRejection', msg)
  }

  // Rage Click 监测：同一路径 1000ms 内连续点击 >= 3 次且非合理连点控件
  let lastClickPath = ''
  let clickTimestamps: number[] = []
  let lastRageReportedAt = 0
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null
    if (!target || target.closest('input,video,audio,[data-evia-allow-rapid-click]'))
      return
    const path = structuralElementPath(target)
    const now = Date.now()
    if (path !== lastClickPath) {
      lastClickPath = path
      clickTimestamps = [now]
      return
    }
    clickTimestamps = clickTimestamps.filter(ts => now - ts <= 1000)
    clickTimestamps.push(now)
    if (clickTimestamps.length >= 3 && now - lastRageReportedAt >= 3000) {
      lastRageReportedAt = now
      trackEvia('rage_click_detected', {
        route_template: getCurrentRouteTemplate().slice(0, 128),
        element_path: path,
        click_count: Math.min(clickTimestamps.length, 50),
      })
      clickTimestamps = []
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('error', onError, true)
  window.addEventListener('unhandledrejection', onRejection)
  document.addEventListener('click', onClick, true)

  detachTelemetry = () => {
    window.clearTimeout(vitalsTimer)
    for (const obs of observers)
      obs.disconnect()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('error', onError, true)
    window.removeEventListener('unhandledrejection', onRejection)
    document.removeEventListener('click', onClick, true)
  }
}

export interface ImpressionBatchTracker {
  observe(element: Element, itemId: number, position: number): void
  unobserve(element: Element): void
  flush(): void
  dispose(): void
}

/**
 * 轻量列表批量曝光追踪器：
 * - 单卡片在当前列表生命周期内仅计一次（IntersectionObserver threshold 0.5）
 * - 每 2 秒或满 10 条打包发一条 feed_impressions_recorded，避免高并发刷屏。
 */
export function createImpressionTracker(source: () => string): ImpressionBatchTracker {
  const seen = new Set<number>()
  const meta = new WeakMap<Element, { itemId: number, position: number }>()
  let pending: { itemId: number, position: number }[] = []
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (!isEviaConsentEnabled() || pending.length === 0) {
      pending = []
      return
    }
    const batch = pending.splice(0, 20)
    trackEvia('feed_impressions_recorded', {
      source: (source() || 'feed').slice(0, 32),
      item_ids: batch.map(b => b.itemId),
      positions: batch.map(b => b.position),
      count: batch.length,
    })
    if (pending.length > 0)
      timer = setTimeout(flush, 500)
  }

  const scheduleFlush = () => {
    if (pending.length >= 10) {
      flush()
      return
    }
    if (timer === null)
      timer = setTimeout(flush, 2000)
  }

  const observer = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting)
            continue
          const info = meta.get(entry.target)
          if (!info || seen.has(info.itemId))
            continue
          seen.add(info.itemId)
          observer?.unobserve(entry.target)
          pending.push(info)
          scheduleFlush()
        }
      }, { threshold: 0.5 })
    : null

  return {
    observe(element: Element, itemId: number, position: number): void {
      if (!observer || !Number.isInteger(itemId) || itemId <= 0 || seen.has(itemId))
        return
      meta.set(element, { itemId, position })
      observer.observe(element)
    },
    unobserve(element: Element): void {
      observer?.unobserve(element)
    },
    flush,
    dispose(): void {
      flush()
      observer?.disconnect()
    },
  }
}
