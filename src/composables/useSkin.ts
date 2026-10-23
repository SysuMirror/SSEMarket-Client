import { computed, reactive, ref, watch, watchEffect } from 'vue'
import type { ThemeEvent, ThemeSettings } from '@/api/theme/theme'
import {
  clampPostCardOpacity,
  DEFAULT_THEME_SETTINGS,
  fetchThemeState,
  normalizeThemeSettings,
  saveThemeSettings,
} from '@/api/theme/theme'
import { getSkin, skinAssetURL } from '@/skins'
import { DEFAULT_THEME_ID, isThemeWindowActive, resolveThemeID } from '@/skins/resolve'
import { useUserStore } from '@/store/userStore'
import { normalizeCustomBackgroundURL, resolveUserImageURL } from '@/utils/imageSource'

/**
 * 全站皮肤状态（模块级单例）。
 *
 * 判定顺序：
 *   1. 后端 /auth/theme/state 给出活动时间窗（北京时间 10.24 当天）；
 *   2. 用户设置 themeMode：auto 跟随活动 / default 强制默认 / <skinID> 强制某套皮肤；
 *   3. 前端注册表 src/skins/ 把 skinID 映射成图片资源。
 *
 * 皮肤资源 URL 一律走 skinAssetURL()（public）；用户上传背景只接受图床绝对地址，
 * 经 resolveUserImageURL() 校验后使用，两者绝不混用。
 */

const STORAGE_KEY = 'sse-theme-prefs-v1'
const SPLASH_SEEN_PREFIX = 'sse-theme-splash-seen:'
const CLOCK_TICK_MS = 30_000

interface SkinRuntimeState {
  /** 首次从后端拿到（或失败）后置 true，App 用它决定何时尝试展示开场画面 */
  ready: boolean
  loading: boolean
  saving: boolean
  event: ThemeEvent | null
  /** 本地缓存先上屏，登录后由服务端设置覆盖 */
  prefs: ThemeSettings
  /** 服务端时间 - 本地时间，用于跨零点自动结束活动 */
  serverOffsetMs: number
  /** 每 30s 推进一次，让活动结束不依赖刷新页面 */
  tick: number
}

function loadCachedPrefs(): ThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw)
      return { ...DEFAULT_THEME_SETTINGS }
    return normalizeThemeSettings(JSON.parse(raw))
  }
  catch {
    return { ...DEFAULT_THEME_SETTINGS }
  }
}

const state = reactive<SkinRuntimeState>({
  ready: false,
  loading: false,
  saving: false,
  event: null,
  prefs: loadCachedPrefs(),
  serverOffsetMs: 0,
  tick: Date.now(),
})

function persistCachedPrefs() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.prefs))
  }
  catch {
    // localStorage 不可用时忽略：服务端仍是权威来源
  }
}

/** 活动时间窗是否正在进行；时间按服务端偏移计算，服务器时区与本地无关。 */
const eventActive = computed(() => isThemeWindowActive(
  state.event,
  state.tick + state.serverOffsetMs,
  state.event?.active ?? false,
))

/**
 * 最终生效的皮肤 ID：
 * auto 跟随活动；default 强制默认；其他值视为用户手动指定的皮肤 ID。
 */
const effectiveThemeId = computed(() => resolveThemeID(
  state.prefs.themeMode,
  state.event,
  eventActive.value,
))

const activeSkin = computed(() => getSkin(effectiveThemeId.value))
const isSkinActive = computed(() => !!activeSkin.value)

/** 用户上传背景：只接受图床 http(s) 绝对地址，非法/相对路径一律视为空。 */
const customBackgroundUrl = computed(() => resolveUserImageURL(state.prefs.customBackgroundUrl))

/**
 * 当前应展示的背景（mobile/desktop 两套）。
 * - 背景关闭 → null；
 * - 自定义来源且有合法图床地址 → 两端同一张用户图；
 * - 否则使用当前皮肤自带背景（默认皮肤没有背景 → null）。
 */
const backgroundSources = computed<{ mobile: string, desktop: string } | null>(() => {
  if (!state.prefs.backgroundEnabled)
    return null
  if (state.prefs.backgroundSource === 'custom') {
    // 选了自定义但还没上传/地址非法：不显示背景，避免误以为用的是皮肤内置图。
    if (!customBackgroundUrl.value)
      return null
    return { mobile: customBackgroundUrl.value, desktop: customBackgroundUrl.value }
  }
  const skin = activeSkin.value
  if (!skin)
    return null
  return {
    mobile: skinAssetURL(skin.id, skin.background.mobile),
    desktop: skinAssetURL(skin.id, skin.background.desktop),
  }
})
const hasBackground = computed(() => !!backgroundSources.value)

/** 开场画面图（仅当前皮肤有）。 */
const splashSources = computed<{ mobile: string, desktop: string } | null>(() => {
  const skin = activeSkin.value
  if (!skin)
    return null
  return {
    mobile: skinAssetURL(skin.id, skin.splash.mobile),
    desktop: skinAssetURL(skin.id, skin.splash.desktop),
  }
})

const splashOpen = ref(false)
let splashDecided = false

function splashSeenKey(themeID: string): string {
  return `${SPLASH_SEEN_PREFIX}${themeID}`
}

function wasSplashSeen(themeID: string): boolean {
  try {
    return sessionStorage.getItem(splashSeenKey(themeID)) === '1'
  }
  catch {
    return false
  }
}

function markSplashSeen(themeID: string) {
  try {
    sessionStorage.setItem(splashSeenKey(themeID), '1')
  }
  catch {
    // 忽略：同一会话内至少还有内存态 splashDecided 兜底
  }
}

/** 首次进入站点时尝试展示一次开场画面（每个会话每套皮肤一次）。 */
function maybeOpenSplash() {
  if (splashDecided || !state.ready)
    return
  splashDecided = true
  const skin = activeSkin.value
  if (!skin || !state.prefs.splashEnabled)
    return
  if (wasSplashSeen(skin.id))
    return
  splashOpen.value = true
}

/** 设置页「预览开场画面」：不受会话去重限制，关闭时仍标记本次会话已看。 */
function previewSplash() {
  if (!activeSkin.value)
    return
  splashOpen.value = true
}

function closeSplash(markSeen = true) {
  const skin = activeSkin.value
  if (markSeen && skin)
    markSplashSeen(skin.id)
  splashOpen.value = false
}

/**
 * 拉取活动时间窗与用户设置。initSkin 不自动调用；
 * App 在登录态就绪后调用一次，登录成功后 userID 变化会再拉一次。
 */
let inflight: Promise<void> | null = null
async function refreshThemeState(): Promise<void> {
  if (inflight)
    return inflight
  inflight = (async () => {
    state.loading = true
    try {
      const result = await fetchThemeState()
      if (result) {
        state.event = result.event
        const serverNow = Date.parse(result.serverTime || result.event?.serverTime || '')
        if (Number.isFinite(serverNow))
          state.serverOffsetMs = serverNow - Date.now()
        // 游客 settings=null：保留本地缓存（默认仍是 auto）；
        // 登录用户以后端设置为准（跨设备一致）。
        if (result.settings) {
          state.prefs = { ...result.settings }
          persistCachedPrefs()
        }
      }
    }
    finally {
      state.loading = false
      state.ready = true
      state.tick = Date.now()
      maybeOpenSplash()
    }
  })().finally(() => {
    inflight = null
  })
  return inflight
}

type UpdateResult = { ok: boolean, msg: string }

/**
 * 更新外观设置：先乐观更新 UI 并落本地缓存，再写服务端；
 * 失败回滚到改动前。保存期间拒绝新的写请求，避免并发覆盖。
 */
async function updatePrefs(patch: Partial<ThemeSettings>): Promise<UpdateResult> {
  if (state.saving)
    return { ok: false, msg: '正在保存，请稍候' }

  const previous: ThemeSettings = { ...state.prefs }
  const next: ThemeSettings = { ...state.prefs, ...patch }

  if ('customBackgroundUrl' in patch) {
    const normalized = normalizeCustomBackgroundURL(next.customBackgroundUrl)
    if (normalized === null)
      return { ok: false, msg: '背景图片地址不合法' }
    next.customBackgroundUrl = normalized
  }

  state.prefs = next
  persistCachedPrefs()

  if (!useUserStore().isLogin.value)
    return { ok: true, msg: '' }

  state.saving = true
  try {
    const result = await saveThemeSettings(next)
    if (!result.ok) {
      state.prefs = previous
      persistCachedPrefs()
      return { ok: false, msg: result.msg }
    }
    if (result.settings) {
      state.prefs = { ...result.settings }
      persistCachedPrefs()
    }
    return { ok: true, msg: result.msg }
  }
  finally {
    state.saving = false
  }
}

function setThemeMode(themeMode: string): Promise<UpdateResult> {
  return updatePrefs({ themeMode })
}

function setSplashEnabled(splashEnabled: boolean): Promise<UpdateResult> {
  return updatePrefs({ splashEnabled })
}

function setBackgroundEnabled(backgroundEnabled: boolean): Promise<UpdateResult> {
  return updatePrefs({ backgroundEnabled })
}

function setBackgroundSource(backgroundSource: 'default' | 'custom'): Promise<UpdateResult> {
  return updatePrefs({ backgroundSource })
}

/** 保存刚上传到图床的背景：同时切到 custom 并打开背景。 */
function setCustomBackground(customBackgroundUrl: string): Promise<UpdateResult> {
  return updatePrefs({
    customBackgroundUrl,
    backgroundSource: 'custom',
    backgroundEnabled: true,
  })
}

function clearCustomBackground(): Promise<UpdateResult> {
  return updatePrefs({ customBackgroundUrl: '', backgroundSource: 'default' })
}

/** 恢复「跟随活动」：活动期间自动用节日皮肤，结束后自动回默认。 */
function resetThemeModeToAuto(): Promise<UpdateResult> {
  return updatePrefs({ themeMode: 'auto' })
}

/** 帖子卡片不透明度（30-100）：调小让全站背景图更明显。 */
function setPostCardOpacity(value: number): Promise<UpdateResult> {
  return updatePrefs({ postCardOpacity: clampPostCardOpacity(value) })
}

let initialized = false

/**
 * 在 main.ts 里调用一次：同步应用本地缓存的皮肤类名，并监听活动结束/登录。
 * 不在这里发网络请求——App 会在登录态就绪后调用 refreshThemeState()。
 */
export function initSkin() {
  if (initialized || typeof document === 'undefined')
    return
  initialized = true

  // 背景层需要 body 透明 + 主题 class；data-skin 为空表示默认皮肤。
  // 帖子卡片透明度以 CSS 变量下发，由 skin-base.css 在「有全站背景」时应用到帖子卡片。
  watchEffect(() => {
    const themeID = effectiveThemeId.value
    document.body.dataset.skin = themeID === DEFAULT_THEME_ID ? '' : themeID
    document.body.classList.toggle('skin-bg-active', hasBackground.value)
    document.documentElement.style.setProperty(
      '--post-card-alpha',
      String(clampPostCardOpacity(state.prefs.postCardOpacity) / 100),
    )
  })

  // 跨零点自动结束活动 / 跨零点自动开始活动：30s 推进一次时钟即可。
  window.setInterval(() => {
    state.tick = Date.now()
  }, CLOCK_TICK_MS)

  // 登录成功后（含 SSO 跳回）重新拉一次，把服务端设置覆盖到本地缓存。
  watch(
    () => useUserStore().userInfo.userID,
    (userID) => {
      if (userID > 0)
        void refreshThemeState()
    },
  )
}

export function useSkin() {
  return {
    state,
    ready: computed(() => state.ready),
    event: computed(() => state.event),
    eventActive,
    effectiveThemeId,
    activeSkin,
    isSkinActive,
    hasBackground,
    backgroundSources,
    splashSources,
    splashOpen,
    customBackgroundUrl,
    refreshThemeState,
    maybeOpenSplash,
    previewSplash,
    closeSplash,
    updatePrefs,
    setThemeMode,
    setSplashEnabled,
    setBackgroundEnabled,
    setBackgroundSource,
    setCustomBackground,
    clearCustomBackground,
    resetThemeModeToAuto,
    setPostCardOpacity,
  }
}
