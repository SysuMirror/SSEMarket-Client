/**
 * Evia 埋点客户端（newSSE 侧唯一入口）。
 *
 * 通过环境变量配置（.env.development / .env.production）：
 *   VITE_EVIA_ENDPOINT / VITE_EVIA_PROJECT_ID / VITE_EVIA_ENV / VITE_EVIA_WRITE_KEY
 * 任一缺失时静默禁用（生产灰度期间可整组留空关闭上报）。
 *
 * 自动行为：页面视图（router 钩子传入）、identify 身份关联、会话结束、
 * 滚动深度、持久队列（刷新不丢，靠服务端幂等去重）。
 */
import type {
  BrowserClient,
  DrainUntilSettledOptions,
  DrainUntilSettledResult,
  Emission,
  EncryptedContentChunk,
} from './vendor/@evia/browser-sdk/index.js'

interface EviaConfig {
  endpoint: string
  projectId: string
  environment: string
  writeKey: string
}

export interface PageNavigation {
  routeName: string
  routePath: string
  routeTemplate: string
  fromRoute: string
}

interface ActivePage {
  routeName: string
  routePath: string
  routeTemplate: string
  enteredAt: number
}

export interface ContentEncryptionConfig {
  key_id: string
  alg: 'RSA-OAEP-256'
  public_jwk: Readonly<Record<string, unknown>>
  project_id: string
  environment: string
}

function envVar(key: string): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  return env?.[key] ?? ''
}

function signingPublicJWK(): Readonly<Record<string, unknown>> | undefined {
  const encoded = envVar('VITE_EVIA_CONFIG_SIGNING_PUBLIC_JWK_B64')
  if (!encoded)
    return undefined
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=')
    return JSON.parse(atob(padded)) as Readonly<Record<string, unknown>>
  }
  catch {
    return undefined
  }
}

export const EVIA_CONSENT_STORAGE_KEY = 'evia:analytics_consent:v1'

function readStoredConsent(): boolean {
  try {
    if (typeof localStorage === 'undefined')
      return true
    return localStorage.getItem(EVIA_CONSENT_STORAGE_KEY) !== '0'
  }
  catch {
    return true
  }
}

function writeStoredConsent(value: boolean): void {
  try {
    if (typeof localStorage !== 'undefined')
      localStorage.setItem(EVIA_CONSENT_STORAGE_KEY, value ? '1' : '0')
  }
  catch {
    // 隐私模式或存储受限时保留内存态
  }
}

type ConsentListener = (enabled: boolean) => void

let client: BrowserClient | null = null
let enabled = false
let initializing = false
let initPromise: Promise<BrowserClient | null> | null = null
let pendingOptOut = false
let consentEnabled = readStoredConsent()
let consentGeneration = 0
let latestUid = ''
let contentEncryption: ContentEncryptionConfig | null = null
let activePage: ActivePage | null = null
const pendingActions: ((ready: BrowserClient) => void)[] = []
const consentListeners = new Set<ConsentListener>()
const MAX_PENDING_ACTIONS = 64

function notifyConsentListeners(value: boolean): void {
  for (const listener of consentListeners) {
    try {
      listener(value)
    }
    catch {
      // 单个监听器失败不影响其他模块
    }
  }
}

export function isEviaConsentEnabled(): boolean {
  return consentEnabled
}

export function onEviaConsentChange(listener: ConsentListener): () => void {
  consentListeners.add(listener)
  return () => {
    consentListeners.delete(listener)
  }
}

function runOrQueue(action: (ready: BrowserClient) => void): void {
  if (!consentEnabled)
    return
  if (client && enabled) {
    try {
      action(client)
    }
    catch {
      // 队列满/校验失败等可预期异常：不影响站点业务
    }
    return
  }
  if (initializing && pendingActions.length < MAX_PENDING_ACTIONS)
    pendingActions.push(action)
}

function refreshClientConfig(target: BrowserClient): Promise<void> {
  return target.init().then((config) => {
    contentEncryption = config.content_encryption
      ? {
          ...config.content_encryption,
          project_id: config.project_id,
          environment: config.environment,
        }
      : null
  }).catch(() => {
    contentEncryption = null
  })
}

export function initEvia(): BrowserClient | null {
  if (!consentEnabled)
    return null
  if (client) {
    if (!enabled) {
      enabled = true
      void client.enable().then((config) => {
        contentEncryption = config.content_encryption
          ? {
              ...config.content_encryption,
              project_id: config.project_id,
              environment: config.environment,
            }
          : null
      }).catch(() => {
        contentEncryption = null
      })
      if (latestUid)
        client.identify(latestUid)
    }
    return client
  }
  if (initializing)
    return null
  const config: EviaConfig = {
    endpoint: envVar('VITE_EVIA_ENDPOINT'),
    projectId: envVar('VITE_EVIA_PROJECT_ID'),
    environment: envVar('VITE_EVIA_ENV') || 'development',
    writeKey: envVar('VITE_EVIA_WRITE_KEY'),
  }
  if (!config.endpoint || !config.projectId || !config.writeKey) {
    console.info('[evia] 埋点未配置，跳过初始化')
    return null
  }
  initializing = true
  // 动态 import 避免把 SDK 打进主 chunk；失败不阻断业务。
  initPromise = import('./vendor/@evia/browser-sdk/index.js').then(({ createEviaClient }) => {
    const created = createEviaClient({
      endpoint: config.endpoint,
      projectId: config.projectId,
      environment: config.environment as 'development' | 'staging' | 'production',
      writeKey: config.writeKey,
      autoPageViews: true,
      autoIdentityLink: true,
      autoSessionEnd: true,
      autoPageScrolls: true,
      autoHeatmapClicks: true,
      configSigningKeyId: envVar('VITE_EVIA_CONFIG_SIGNING_KEY_ID') || undefined,
      configSigningPublicJWK: signingPublicJWK(),
      persistQueue: true,
      persistSession: true,
      // Encrypted replay chunks are near-uniform and remain under the 60 KiB
      // request-byte cap; allow the SDK to pack up to 50 per request instead of
      // the conservative general-event default of 20.
      maxBatchEvents: 50,
      // Preserve large replay groups across long weak-network drains while the
      // overall session byte budget remains independently bounded.
      maxAgeMs: 15 * 60 * 1000,
      lifecycle: true,
    })
    client = created
    initializing = false
    if (!consentEnabled && !pendingOptOut) {
      enabled = false
      pendingActions.length = 0
      created.disable()
      return created
    }
    enabled = true
    if (latestUid) {
      try {
        created.identify(latestUid)
      }
      catch {
        // ignore identify failure during init
      }
    }
    void refreshClientConfig(created)
    if (!consentEnabled) {
      pendingActions.length = 0
      return created
    }
    const queued = pendingActions.splice(0)
    for (const action of queued) {
      try {
        action(created)
      }
      catch {
        // 单条待执行动作失败不阻断其余动作
      }
    }
    return created
  }).catch((e) => {
    initializing = false
    pendingActions.length = 0
    console.warn('[evia] SDK 加载失败', e)
    return null
  })
  return null
}

/**
 * 切换「帮助集市变得更好」采集开关。
 * 从开启切到关闭时，先停止会话回放与后续常规埋点，上报关闭事件并等待有界送达后再禁用 SDK。
 */
export async function setEviaConsentEnabled(
  nextEnabled: boolean,
  options: { source?: string } = {},
): Promise<void> {
  const previous = consentEnabled
  const source = (options.source || 'options').slice(0, 64)
  if (nextEnabled === previous)
    return

  const myGeneration = ++consentGeneration
  consentEnabled = nextEnabled
  writeStoredConsent(nextEnabled)

  if (!nextEnabled) {
    pendingActions.length = 0
    activePage = null
    notifyConsentListeners(false)

    if (!client && initializing && initPromise) {
      pendingOptOut = true
      try {
        await Promise.race([
          initPromise,
          new Promise<null>(resolve => setTimeout(() => resolve(null), 3000)),
        ])
      }
      finally {
        pendingOptOut = false
      }
    }

    if (client && enabled) {
      try {
        const emission = client.emit('analytics_preference_changed', {
          enabled: false,
          previous_enabled: previous,
          source,
        })
        await client.drainUntilSettled([emission], { timeoutMs: 4000, maxRounds: 8 })
      }
      catch {
        // 网络不可达或队列受限时仍确保最终关闭 SDK
      }
    }

    if (consentGeneration === myGeneration && !consentEnabled) {
      enabled = false
      contentEncryption = null
      client?.disable()
    }
    return
  }

  notifyConsentListeners(true)

  if (client) {
    enabled = true
    try {
      const config = await client.enable()
      contentEncryption = config.content_encryption
        ? {
            ...config.content_encryption,
            project_id: config.project_id,
            environment: config.environment,
          }
        : null
    }
    catch {
      contentEncryption = null
    }
    if (consentGeneration !== myGeneration || !consentEnabled)
      return
    if (latestUid) {
      try {
        client.identify(latestUid)
      }
      catch {
        // ignore identify failure
      }
    }
    try {
      client.emit('analytics_preference_changed', {
        enabled: true,
        previous_enabled: previous,
        source,
      })
    }
    catch {
      // ignore emit failure
    }
    return
  }

  initEvia()
  runOrQueue(ready => ready.emit('analytics_preference_changed', {
    enabled: true,
    previous_enabled: previous,
    source,
  }))
}

export function getContentEncryptionConfig(): ContentEncryptionConfig | null {
  return consentEnabled ? contentEncryption : null
}

export async function waitForContentEncryptionConfig(timeoutMs = 5000): Promise<ContentEncryptionConfig | null> {
  if (!consentEnabled)
    return null
  const deadline = Date.now() + Math.max(0, timeoutMs)
  let refreshAttempted = false
  while (Date.now() <= deadline) {
    if (!consentEnabled)
      return null
    if (contentEncryption)
      return contentEncryption
    if (client && enabled && !refreshAttempted) {
      refreshAttempted = true
      try {
        const config = await client.refreshConfig()
        contentEncryption = config.content_encryption
          ? {
              ...config.content_encryption,
              project_id: config.project_id,
              environment: config.environment,
            }
          : null
      }
      catch {
        // Continue the bounded wait; caller still fails closed at the deadline.
      }
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  return null
}

/** 登录成功后绑定业务身份；uid 用站内稳定键（newsse-u<userID>）。 */
export function identifyEvia(uid: string): void {
  latestUid = uid
  if (client && enabled)
    runOrQueue(ready => ready.identify(uid))
}

/** 登出/切换账号：旋转会话与匿名范围。 */
export function resetEvia(): void {
  latestUid = ''
  if (client && enabled)
    runOrQueue(ready => ready.reset())
}

/** SPA 路由切换：更新页面上下文（不自动发页面事件，由 autoPageViews 发）。 */
export function navigateEvia(routeName: string): void {
  runOrQueue(ready => ready.navigate({ routeName }))
}

/** 业务事件上报：属性必须是标量或标量数组（snake_case 键）。 */
export function trackEvia(eventKey: string, properties: Record<string, string | number | boolean | (string | number | boolean)[]> = {}): void {
  runOrQueue(ready => ready.emit(eventKey, properties))
}

function referrerHost(): string {
  if (typeof document === 'undefined' || !document.referrer)
    return ''
  try {
    return new URL(document.referrer).host.slice(0, 128)
  }
  catch {
    return ''
  }
}

function connectionType(): string {
  if (typeof navigator === 'undefined')
    return 'unknown'
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
  const value = connection?.effectiveType
  return value === 'slow-2g' || value === '2g' || value === '3g' || value === '4g'
    ? value
    : 'unknown'
}

function deviceType(width: number): string {
  if (width < 768)
    return 'mobile'
  if (width < 1100)
    return 'tablet'
  return 'desktop'
}

function exitActivePage(exitType: 'route_change' | 'pagehide'): void {
  if (!activePage)
    return
  trackEvia('page_exited', {
    route_name: activePage.routeName,
    route_path: activePage.routePath,
    route_template: activePage.routeTemplate,
    dwell_ms: Math.min(Math.max(Date.now() - activePage.enteredAt, 0), 3_600_000),
    exit_type: exitType,
  })
  activePage = null
}

/**
 * SPA 页面访问画像：公共 envelope 已携带身份/会话/顺序，本事件只补
 * 路由来源、设备与视口维度，不采 query/hash、输入值、cookie 或完整 UA。
 */
export function trackPageNavigation(page: PageNavigation): void {
  if (!consentEnabled) {
    activePage = null
    return
  }
  exitActivePage('route_change')
  navigateEvia(page.routeName)
  const viewportWidth = Math.max(1, Math.min(65535, Math.round(window.innerWidth)))
  const viewportHeight = Math.max(1, Math.min(65535, Math.round(window.innerHeight)))
  const screenWidth = Math.max(1, Math.min(65535, Math.round(window.screen.width)))
  const screenHeight = Math.max(1, Math.min(65535, Math.round(window.screen.height)))
  const referrer = referrerHost()
  const properties: Record<string, string | number> = {
    route_name: page.routeName.slice(0, 128),
    route_path: page.routePath.slice(0, 256),
    route_template: page.routeTemplate.slice(0, 256),
    from_route: page.fromRoute.slice(0, 128),
    entry_type: referrer && !page.fromRoute ? 'referral' : (page.fromRoute ? 'spa' : 'direct'),
    device_type: deviceType(viewportWidth),
    viewport_width: viewportWidth,
    viewport_height: viewportHeight,
    screen_width: screenWidth,
    screen_height: screenHeight,
    language: (navigator.language || 'unknown').slice(0, 32),
    timezone_offset_minutes: new Date().getTimezoneOffset(),
    connection_type: connectionType(),
  }
  if (referrer)
    properties.referrer_host = referrer
  trackEvia('page_opened', properties)
  activePage = {
    routeName: page.routeName,
    routePath: page.routePath,
    routeTemplate: page.routeTemplate,
    enteredAt: Date.now(),
  }
}

/** pagehide 时在 SDK keepalive flush 前补最后一条停留事件。 */
export function trackPageHide(): void {
  exitActivePage('pagehide')
}

export function trackEncryptedContentChunk(chunk: EncryptedContentChunk): Emission | null {
  const emissions = trackEncryptedContentChunks([chunk])
  return emissions?.[0] ?? null
}

/** 原子校验并入队一组通用密文事件；失败时不留下隐藏前缀。 */
export function trackEncryptedContentChunks(chunks: readonly EncryptedContentChunk[]): readonly Emission[] | null {
  if (!consentEnabled || !enabled || !client)
    return null
  try {
    return client.emitEncryptedContentChunks(chunks)
  }
  catch (error) {
    console.warn('[evia] 密文事件组未入队', error instanceof Error ? error.message : 'unknown')
    return null
  }
}

/** 仅等待调用方持有的 emission，不受队列内无关事件影响。 */
export function drainEncryptedContent(
  emissions: readonly Emission[],
  options: DrainUntilSettledOptions = {},
): Promise<DrainUntilSettledResult> | null {
  if (!consentEnabled || !enabled || !client)
    return null
  return client.drainUntilSettled(emissions, options)
}

/** 关键节点强制冲刷（如支付完成）。 */
export function flushEvia(): Promise<{ pending: number }> | null {
  if (!consentEnabled || !enabled || !client)
    return null
  return client.flush()
}

/** 将当前持久队列按 SDK 有界 batch 连续冲刷；仅用于显式高体积检查点。 */
export async function drainEvia(maxRounds = 64): Promise<{ pending: number } | null> {
  if (!consentEnabled || !enabled || !client)
    return null
  let result = await client.flush()
  for (let round = 1; result.pending > 0 && round < maxRounds; round++) {
    const previous = result.pending
    result = await client.flush()
    if (result.pending >= previous)
      await new Promise(resolve => setTimeout(resolve, 100))
  }
  return result
}
