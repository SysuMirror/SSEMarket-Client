/**
 * Evia 埋点客户端（newSSE 侧唯一入口）。
 *
 * 通过环境变量配置（.env.development / .env.production）：
 *   VITE_EVIA_ENDPOINT / VITE_EVIA_PROJECT_ID / VITE_EVIA_ENV / VITE_EVIA_WRITE_KEY
 * 任一缺失时静默禁用（生产灰度期间可整组留空关闭上报）。
 *
 * 自动行为：页面视图（router 钩子传入）、identify 身份关联、会话结束、
 * 滚动深度、热力图点击、活跃停留时长、归因参数、持久队列（刷新不丢，靠服务端幂等去重）。
 */
import type {
  BrowserClient,
  DrainUntilSettledOptions,
  DrainUntilSettledResult,
  Emission,
  EncryptedContentChunk,
  OperationFailure,
  PageOptions,
} from './vendor/@evia/browser-sdk/index.js'

declare const __EVIA_APP_VERSION__: string | undefined

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
  navigationType?: PageOptions['navigationType']
}

interface ActivePage {
  routeName: string
  routePath: string
  routeTemplate: string
  enteredAt: number
  dwell: ActiveDwellTracker
}

export interface ActiveDwellSnapshot {
  totalMs: number
  activeMs: number
  hiddenCount: number
}

export interface ActiveDwellTracker {
  snapshot(): ActiveDwellSnapshot
  dispose(): void
}

export interface AttributionParams {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  share_from?: string
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

export function getAppVersion(): string {
  try {
    if (typeof __EVIA_APP_VERSION__ === 'string' && __EVIA_APP_VERSION__)
      return __EVIA_APP_VERSION__.slice(0, 32)
  }
  catch {
    // Node 单测环境未经过 Vite define 替换时回退
  }
  return (envVar('VITE_APP_VERSION') || 'dev').slice(0, 32)
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
const ATTRIBUTION_STORAGE_KEY = 'evia:session_attribution:v1'
const POST_ENTRY_STORAGE_KEY = 'evia:post_entry:v1'
const PROFILE_SNAPSHOT_STORAGE_KEY = 'evia:profile_snapshot_sent:v1'
const REC_EXPERIMENT_STORAGE_KEY = 'evia:rec_experiment_exposed:v1'
const MAX_DWELL_MS = 3_600_000
let lastSearchState: { id: string, at: number } | null = null
let recExperimentExposed = false

export interface PostEntryHint {
  postId: number
  source: string
  rank?: number
  at: number
}

/** 记录即将打开帖子的来源入口与位次，避免污染详情页 URL，10 秒内有效。 */
export function markPostEntry(postId: number, source: string, rank?: number): void {
  if (!Number.isFinite(postId) || postId <= 0 || !source)
    return
  const hint: PostEntryHint = {
    postId,
    source: source.slice(0, 32),
    ...(Number.isInteger(rank) && (rank as number) > 0 ? { rank: Math.min(rank as number, 500) } : {}),
    at: Date.now(),
  }
  try {
    if (typeof sessionStorage !== 'undefined')
      sessionStorage.setItem(POST_ENTRY_STORAGE_KEY, JSON.stringify(hint))
  }
  catch {
    // ignore storage restriction
  }
}

export function consumePostEntry(postId: number): { source: string, rank?: number } | null {
  try {
    if (typeof sessionStorage === 'undefined')
      return null
    const raw = sessionStorage.getItem(POST_ENTRY_STORAGE_KEY)
    if (!raw)
      return null
    const hint = JSON.parse(raw) as Partial<PostEntryHint>
    if (hint.postId !== postId || typeof hint.source !== 'string' || !hint.source)
      return null
    sessionStorage.removeItem(POST_ENTRY_STORAGE_KEY)
    if (typeof hint.at === 'number' && Date.now() - hint.at > 10_000)
      return null
    return {
      source: hint.source.slice(0, 32),
      ...(Number.isInteger(hint.rank) && (hint.rank as number) > 0 ? { rank: hint.rank } : {}),
    }
  }
  catch {
    return null
  }
}

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
let currentRouteTemplate = ''
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

export function getCurrentRouteTemplate(): string {
  return currentRouteTemplate || (typeof location !== 'undefined' ? location.pathname.slice(0, 128) : '/')
}

/** 精确追踪页面可见活跃停留时长（剔除切后台/锁屏挂机时间）。 */
export function createActiveDwellTracker(): ActiveDwellTracker {
  const startedAt = Date.now()
  let visibleSince: number | null = (typeof document === 'undefined' || document.visibilityState !== 'hidden')
    ? startedAt
    : null
  let accumulatedActiveMs = 0
  let hiddenCount = 0

  const onVisibilityChange = () => {
    const now = Date.now()
    if (document.visibilityState === 'hidden') {
      if (visibleSince !== null) {
        accumulatedActiveMs += Math.max(0, now - visibleSince)
        visibleSince = null
      }
      hiddenCount += 1
    }
    else if (visibleSince === null) {
      visibleSince = now
    }
  }

  if (typeof document !== 'undefined')
    document.addEventListener('visibilitychange', onVisibilityChange)

  return {
    snapshot(): ActiveDwellSnapshot {
      const now = Date.now()
      const currentVisible = visibleSince !== null ? Math.max(0, now - visibleSince) : 0
      const totalMs = Math.min(Math.max(now - startedAt, 0), MAX_DWELL_MS)
      const activeMs = Math.min(Math.max(accumulatedActiveMs + currentVisible, 0), totalMs)
      return { totalMs, activeMs, hiddenCount }
    },
    dispose(): void {
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', onVisibilityChange)
    },
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
    activePage?.dwell.dispose()
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

/** SPA 路由切换：透传 routeName / routeTemplate / navigationType，激活 SDK 因果流转与热力图模板聚合。 */
export function navigateEvia(options: string | PageOptions): void {
  const payload: PageOptions = typeof options === 'string'
    ? { routeName: options }
    : options
  runOrQueue(ready => ready.navigate(payload))
}

/** 业务事件上报：属性必须是标量或标量数组（snake_case 键）。 */
export function trackEvia(eventKey: string, properties: Record<string, string | number | boolean | (string | number | boolean)[]> = {}): void {
  runOrQueue(ready => ready.emit(eventKey, properties))
}

/** 上报结构化终端操作失败（平台保留事件 sys.operation_failed，不含原始异常或敏感载荷）。 */
export function reportEviaOperationFailure(failure: OperationFailure): void {
  const sanitized: OperationFailure = {
    operation: failure.operation.replace(/[^a-zA-Z0-9_.:/-]/g, '_').slice(0, 128) || 'unknown',
    errorCategory: failure.errorCategory,
    retryable: Boolean(failure.retryable),
    ...(failure.errorCode ? { errorCode: failure.errorCode.replace(/[^a-zA-Z0-9_.:/-]/g, '_').slice(0, 128) } : {}),
  }
  runOrQueue(ready => ready.reportOperationFailure(sanitized))
}

/** 预留 A/B 实验曝光上报接口，用于后续算法或 UI 灰度因果评估。 */
export function trackExperimentExposure(experimentKey: string, variant: string, source = 'client'): void {
  const key = experimentKey.trim().slice(0, 64)
  const v = variant.trim().slice(0, 64)
  if (!key || !v)
    return
  trackEvia('experiment_exposed', {
    experiment_key: key,
    variant: v,
    source: source.slice(0, 64),
  })
}

export function bucketLength(len: number, step = 50, maxBucket = 20): number {
  if (!Number.isFinite(len) || len <= 0)
    return 0
  return Math.min(Math.ceil(len / step), maxBucket)
}

export function bucketPrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0)
    return '0'
  if (price < 20)
    return '1_19'
  if (price < 50)
    return '20_49'
  if (price < 100)
    return '50_99'
  if (price < 300)
    return '100_299'
  if (price < 1000)
    return '300_999'
  return '1000_plus'
}

export function bucketAgeHours(createdAt?: string | number): string {
  if (createdAt === undefined || createdAt === null || createdAt === '')
    return 'unknown'
  let ms = typeof createdAt === 'number' ? createdAt : Date.parse(createdAt)
  if (!Number.isFinite(ms) && typeof createdAt === 'string')
    ms = Date.parse(createdAt.trim().replace(' ', 'T'))
  if (!Number.isFinite(ms))
    return 'unknown'
  const hours = Math.max(0, (Date.now() - ms) / 3_600_000)
  if (hours < 1)
    return 'lt_1h'
  if (hours < 6)
    return '1_6h'
  if (hours < 24)
    return '6_24h'
  if (hours < 72)
    return '1_3d'
  if (hours < 168)
    return '3_7d'
  if (hours < 720)
    return '7_30d'
  return 'gt_30d'
}

export function bucketCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0)
    return '0'
  if (count <= 5)
    return '1_5'
  if (count <= 20)
    return '6_20'
  if (count <= 100)
    return '21_100'
  return 'gt_100'
}

export function bucketScore(score: number): string {
  if (!Number.isFinite(score) || score <= 0)
    return '0'
  if (score < 100)
    return '1_99'
  if (score < 500)
    return '100_499'
  if (score < 2000)
    return '500_1999'
  if (score < 5000)
    return '2000_4999'
  return '5000_plus'
}

export function bucketCoins(coins: number): string {
  if (!Number.isFinite(coins) || coins <= 0)
    return '0'
  if (coins <= 10)
    return '1_10'
  if (coins <= 50)
    return '11_50'
  if (coins <= 200)
    return '51_200'
  return 'gt_200'
}

export function detectDisplayMode(): { isPwa: boolean, displayMode: 'pwa_standalone' | 'browser' } {
  if (typeof window === 'undefined')
    return { isPwa: false, displayMode: 'browser' }
  try {
    const params = new URLSearchParams(window.location.search)
    const standalone = params.get('pwa') === 'true'
      || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
      || (typeof document !== 'undefined' && document.referrer.includes('android-app://'))
    return { isPwa: Boolean(standalone), displayMode: standalone ? 'pwa_standalone' : 'browser' }
  }
  catch {
    return { isPwa: false, displayMode: 'browser' }
  }
}

/** 记录搜索会话链：60 秒内再次发起搜索视为改写重搜，返回前一次 search_id。 */
export function recordSearchAndGetPrevious(searchId: string): string {
  const now = Date.now()
  const prev = lastSearchState && now - lastSearchState.at <= 60_000 ? lastSearchState.id : ''
  lastSearchState = { id: searchId, at: now }
  return prev
}

/** 前端校验拦截埋点（如超字数、文件超限、格式不符等未到 HTTP 层的隐性摩擦）。 */
export function reportValidationBlocked(form: string, reason: string): void {
  trackEvia('client_validation_blocked', {
    form: form.slice(0, 64),
    reason: reason.slice(0, 64),
  })
}

export interface SessionProfileSnapshotInput {
  userId: number
  userIdentity?: string
  score?: number
  coins?: number
  recMode?: string
  recEffective?: string
  recGrayMatched?: boolean
  pushEnabled?: boolean
}

/** 每会话上报一次非 PII 用户分层画像快照，并同步上报推荐系统灰度实验曝光。 */
export function reportSessionProfileSnapshot(input: SessionProfileSnapshotInput): void {
  if (!consentEnabled || !Number.isFinite(input.userId) || input.userId <= 0)
    return
  if (typeof input.recGrayMatched === 'boolean' && !recExperimentExposed) {
    let alreadySent = false
    try {
      if (typeof sessionStorage !== 'undefined')
        alreadySent = sessionStorage.getItem(REC_EXPERIMENT_STORAGE_KEY) === '1'
    }
    catch {
      // ignore storage restriction
    }
    recExperimentExposed = true
    if (!alreadySent) {
      try {
        if (typeof sessionStorage !== 'undefined')
          sessionStorage.setItem(REC_EXPERIMENT_STORAGE_KEY, '1')
      }
      catch {
        // ignore storage restriction
      }
      trackExperimentExposure(
        'home_recommendation',
        input.recGrayMatched ? 'treatment' : 'control',
        'recommendation_settings',
      )
    }
  }
  const key = `${input.userId}:${input.recEffective ?? ''}`
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(PROFILE_SNAPSHOT_STORAGE_KEY) === key)
      return
    if (typeof sessionStorage !== 'undefined')
      sessionStorage.setItem(PROFILE_SNAPSHOT_STORAGE_KEY, key)
  }
  catch {
    // ignore storage restriction
  }
  const { isPwa, displayMode } = detectDisplayMode()
  const props: Record<string, string | number | boolean> = {
    user_identity: (input.userIdentity || 'user').slice(0, 32),
    score_bucket: bucketScore(input.score ?? 0),
    coin_bucket: bucketCoins(input.coins ?? 0),
    is_pwa: isPwa,
    display_mode: displayMode,
    theme_mode: currentThemeMode(),
    app_version: getAppVersion(),
  }
  if (input.recMode)
    props.rec_mode = input.recMode.slice(0, 16)
  if (input.recEffective)
    props.rec_effective = input.recEffective.slice(0, 16)
  if (typeof input.recGrayMatched === 'boolean')
    props.rec_gray_matched = input.recGrayMatched
  if (typeof input.pushEnabled === 'boolean')
    props.push_enabled = input.pushEnabled
  trackEvia('session_profile_snapshot', props)
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

export function connectionType(): string {
  if (typeof navigator === 'undefined')
    return 'unknown'
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
  const value = connection?.effectiveType
  return value === 'slow-2g' || value === '2g' || value === '3g' || value === '4g'
    ? value
    : 'unknown'
}

export function deviceType(width: number): string {
  if (width < 768)
    return 'mobile'
  if (width < 1100)
    return 'tablet'
  return 'desktop'
}

function detectOsFamily(): string {
  if (typeof navigator === 'undefined')
    return 'unknown'
  const ua = navigator.userAgent || ''
  if (/HarmonyOS/i.test(ua))
    return 'harmonyos'
  if (/Android/i.test(ua))
    return 'android'
  if (/iPhone|iPad|iPod/i.test(ua))
    return 'ios'
  if (/Mac OS X|Macintosh/i.test(ua))
    return 'macos'
  if (/Windows/i.test(ua))
    return 'windows'
  if (/Linux/i.test(ua))
    return 'linux'
  return 'other'
}

function detectBrowserFamily(): string {
  if (typeof navigator === 'undefined')
    return 'unknown'
  const ua = navigator.userAgent || ''
  if (/MicroMessenger/i.test(ua))
    return 'wechat'
  if (/QQ\//i.test(ua))
    return 'qq'
  if (/Edg\//i.test(ua))
    return 'edge'
  if (/Firefox\//i.test(ua))
    return 'firefox'
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua))
    return 'chrome'
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua))
    return 'safari'
  return 'other'
}

function currentThemeMode(): 'dark' | 'light' {
  if (typeof document !== 'undefined' && document.body?.classList.contains('dark-mode'))
    return 'dark'
  return 'light'
}

function sanitizeAttrValue(value: string | null): string | undefined {
  if (!value)
    return undefined
  const clean = value.trim().replace(/[^\w.-]/g, '').slice(0, 64)
  return clean || undefined
}

/** 仅提取白名单渠道归因参数，并在当前会话内持久化，不采集任意 query 参数。 */
export function resolveSessionAttribution(): AttributionParams {
  const fromUrl: AttributionParams = {}
  if (typeof location !== 'undefined' && location.search) {
    try {
      const params = new URLSearchParams(location.search)
      const utmSource = sanitizeAttrValue(params.get('utm_source'))
      const utmMedium = sanitizeAttrValue(params.get('utm_medium'))
      const utmCampaign = sanitizeAttrValue(params.get('utm_campaign'))
      const shareFrom = sanitizeAttrValue(params.get('share_from'))
      if (utmSource)
        fromUrl.utm_source = utmSource
      if (utmMedium)
        fromUrl.utm_medium = utmMedium
      if (utmCampaign)
        fromUrl.utm_campaign = utmCampaign
      if (shareFrom)
        fromUrl.share_from = shareFrom
    }
    catch {
      // ignore invalid URL search
    }
  }
  if (Object.keys(fromUrl).length > 0) {
    try {
      if (typeof sessionStorage !== 'undefined')
        sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(fromUrl))
    }
    catch {
      // ignore storage failure
    }
    return fromUrl
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY)
      if (raw)
        return JSON.parse(raw) as AttributionParams
    }
  }
  catch {
    // ignore parse/storage failure
  }
  return {}
}

function exitActivePage(exitType: 'route_change' | 'pagehide'): void {
  if (!activePage)
    return
  const snap = activePage.dwell.snapshot()
  activePage.dwell.dispose()
  trackEvia('page_exited', {
    route_name: activePage.routeName,
    route_path: activePage.routePath,
    route_template: activePage.routeTemplate,
    dwell_ms: snap.totalMs,
    active_dwell_ms: snap.activeMs,
    hidden_count: Math.min(snap.hiddenCount, 1000),
    exit_type: exitType,
  })
  activePage = null
}

/**
 * SPA 页面访问画像：公共 envelope 已携带身份/会话/顺序，本事件补齐
 * 路由来源、设备、粗粒度环境、版本与白名单归因维度，不采任意 query/hash、输入值、cookie 或完整 UA。
 */
export function trackPageNavigation(page: PageNavigation): void {
  currentRouteTemplate = page.routeTemplate.slice(0, 128)
  if (!consentEnabled) {
    activePage?.dwell.dispose()
    activePage = null
    return
  }
  exitActivePage('route_change')
  navigateEvia({
    routeName: page.routeName.slice(0, 128),
    routeTemplate: page.routeTemplate.slice(0, 128),
    navigationType: page.navigationType ?? (page.fromRoute ? 'push' : 'initial'),
  })
  const viewportWidth = Math.max(1, Math.min(65535, Math.round(window.innerWidth)))
  const viewportHeight = Math.max(1, Math.min(65535, Math.round(window.innerHeight)))
  const screenWidth = Math.max(1, Math.min(65535, Math.round(window.screen.width)))
  const screenHeight = Math.max(1, Math.min(65535, Math.round(window.screen.height)))
  const referrer = referrerHost()
  const attribution = resolveSessionAttribution()
  const { isPwa, displayMode } = detectDisplayMode()
  const properties: Record<string, string | number | boolean> = {
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
    app_version: getAppVersion(),
    theme_mode: currentThemeMode(),
    os_family: detectOsFamily(),
    browser_family: detectBrowserFamily(),
    is_logged_in: Boolean(latestUid),
    is_pwa: isPwa,
    display_mode: displayMode,
  }
  if (referrer)
    properties.referrer_host = referrer
  if (attribution.utm_source)
    properties.utm_source = attribution.utm_source
  if (attribution.utm_medium)
    properties.utm_medium = attribution.utm_medium
  if (attribution.utm_campaign)
    properties.utm_campaign = attribution.utm_campaign
  if (attribution.share_from)
    properties.share_from = attribution.share_from
  trackEvia('page_opened', properties)
  activePage = {
    routeName: page.routeName,
    routePath: page.routePath,
    routeTemplate: page.routeTemplate,
    enteredAt: Date.now(),
    dwell: createActiveDwellTracker(),
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
