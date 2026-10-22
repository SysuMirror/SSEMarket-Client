import type { PresenceScene } from '@/api/presence/presence'
import { ref } from 'vue'
import { sendPresenceHeartbeat } from '@/api/presence/presence'

/**
 * 全站在线心跳（模块级单例）。
 *
 * DefaultLayout 登录后调用 start()，之后每 HEARTBEAT_MS 上报一次；
 * 页面里的 PresenceBadge 只负责通过 setTarget/releaseTarget 切换「当前场景」，
 * 不自己起定时器 —— 整个站点同一时刻最多一个心跳循环、一个上报请求。
 *
 * 频率与新帖轮询（newPostsStore，60 秒一次）保持一致，不再额外加快；
 * 页面切后台时暂停上报，回到前台立即补一次，避免后台标签页刷在线人数。
 * 服务端在线判定窗口是 150 秒，所以即使漏掉一两次心跳也不会误判离线。
 */
const HEARTBEAT_MS = 60_000

const online = ref(0)
const viewers = ref(0)
const currentScene = ref<PresenceScene>('home')
const currentTargetID = ref(0)
const active = ref(false)

let timer: ReturnType<typeof setInterval> | null = null
let inFlight = false
let visibilityBound = false
/** 当前「占用」场景的徽标 token；避免旧页面卸载晚于新页面挂载时清掉新目标。 */
let activeToken = 0

function shouldBeat() {
  return active.value && !document.hidden
}

async function beat() {
  if (!shouldBeat() || inFlight)
    return
  inFlight = true
  try {
    const snapshot = await sendPresenceHeartbeat(currentScene.value, currentTargetID.value)
    if (snapshot) {
      online.value = snapshot.online
      viewers.value = snapshot.viewers
    }
  }
  finally {
    inFlight = false
  }
}

function onVisibilityChange() {
  if (!document.hidden)
    void beat()
}

function start() {
  if (timer)
    return
  active.value = true
  if (!visibilityBound) {
    document.addEventListener('visibilitychange', onVisibilityChange)
    visibilityBound = true
  }
  void beat()
  timer = setInterval(() => {
    void beat()
  }, HEARTBEAT_MS)
}

function stop() {
  active.value = false
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (visibilityBound) {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    visibilityBound = false
  }
}

/** 切换「我在看什么」；场景/内容变化后立即补一次心跳，让徽标数字尽快更新。 */
function setTarget(scene: PresenceScene, targetID = 0, token = 0) {
  activeToken = token
  currentScene.value = scene
  currentTargetID.value = scene === 'home' ? 0 : targetID
  void beat()
}

/**
 * 离开页面时释放目标。只有仍持有当前 token 的组件才能清空目标，
 * 避免旧页面卸载晚于新页面挂载时把新页面的目标清掉（路由切换时卸载/挂载顺序并不绝对）。
 */
function releaseTarget(token: number) {
  if (activeToken !== token)
    return
  activeToken = 0
  currentScene.value = 'home'
  currentTargetID.value = 0
  void beat()
}

export function usePresence() {
  return {
    online,
    viewers,
    currentScene,
    currentTargetID,
    start,
    stop,
    setTarget,
    releaseTarget,
    refresh: beat,
  }
}
