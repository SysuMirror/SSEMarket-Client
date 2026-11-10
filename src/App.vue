<script setup lang="ts">
import {
  onBeforeMount,
  onUnmounted,
  ref,
} from 'vue'
import { getInfo, getSelfAllInfo } from './api/info/getInfo'
import { reportDailyVisit } from './api/coin/coin'
import { ssoTry } from './api/sso/sso'
import router from './router'
import { useUserStore } from './store/userStore'

import TitleCustomizeModal from '@/components/TitleCustomizeModal.vue'
import NowPlayingOverlay from '@/components/music/NowPlayingOverlay.vue'
import PlayerBar from '@/components/music/PlayerBar.vue'
import PlaylistDrawer from '@/components/music/PlaylistDrawer.vue'
import FestivalSplash from '@/components/skin/FestivalSplash.vue'
import SkinShareAddDialog from '@/components/skin/SkinShareAddDialog.vue'
import SkinBackground from '@/components/skin/SkinBackground.vue'
import SkinDecorLayer from '@/components/skin/SkinDecorLayer.vue'
import { useSkin } from '@/composables/useSkin'

const { setUserInfo, userInfo, token, refreshToken, setToken, setRefreshToken } = useUserStore()
const { refreshThemeState } = useSkin()

const isUserReady = ref(false)
const showTitleModal = ref(false)

// 满级且未自定义称号时,弹强制自定义弹窗
async function checkCustomTitleModal() {
  try {
    if (!token.value || !userInfo.userID)
      return
    const info = await getSelfAllInfo(userInfo.userID)
    if (info.score >= 5000 && !(info.customTitle || '').trim())
      showTitleModal.value = true
  }
  catch {
  }
}

function onTitleSaved() {
  showTitleModal.value = false
}

/**
 * @description 离开页面时，如果localStorage.rememberMe不存在，删除token
 */
function handleBeforeUnload() {
  localStorage.removeItem('token')
}

/**
 * 每日进入网页 +1 币：登录态就绪后上报一次。
 * 「今天领没领」只由后端记录（coin_ledger 幂等键含用户+日期），
 * 前端不缓存判断 —— 切换账号后新账号照常能领当天的币。
 */
function reportVisitIfLoggedIn() {
  if (token.value && userInfo.userID > 0)
    void reportDailyVisit()
}

onBeforeMount(async () => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  // 旧版本曾把邮箱密码留在 localStorage 做自动登录；统一登录后该分支已删除，清理残留。
  localStorage.removeItem('email')
  localStorage.removeItem('password')
  const hadLocal = !!token.value || !!refreshToken.value

  try {
    // 每次启动都核对共享父域会话：即使本地已有会话，也要能感知其他平台的单点登出。
    const sso = await ssoTry()
    if (sso.state === 'ok') {
      setToken(sso.token)
      setRefreshToken(sso.refresh_token)
      const info = await getInfo()
      if (info && info.userID && info.userID !== 0) {
        setUserInfo(info)
        reportVisitIfLoggedIn()
      }
    }
    else if (sso.state === 'unauthorized') {
      // 共享会话已失效或已被登出（含 no_sso）：本地会话作废，回登录页。
      setToken('')
      setRefreshToken('')
      setUserInfo({ userID: 0, name: '', avatarURL: '', phone: '', email: '', identity: '', coins: 0 })
      localStorage.removeItem('token')
      localStorage.removeItem('rememberMe')
      // 等初始导航（含守卫对深链的处理）落定再决定跳转：onBeforeMount 里
      // router.currentRoute 仍是起始位置，直接用会把 /connect?appid=... 这类
      // 授权入口覆盖成 redirect=%2F。isReady 后守卫已把带完整 query 的深链
      // 放进 /auth/login，这里就无需再跳。
      await Promise.race([router.isReady(), new Promise(resolve => setTimeout(resolve, 1000))])
      const current = router.currentRoute.value
      if (!current.path.startsWith('/auth') && !current.meta.public)
        router.replace(`/auth/login?redirect=${encodeURIComponent(current.fullPath)}`)
    }
    else if (hadLocal) {
      // unisso/网络不可达：不能把故障当登出，保留本地会话并尝试续期。
      try {
        const info = await getInfo()
        if (info && info.userID && info.userID !== 0) {
          setUserInfo(info)
          reportVisitIfLoggedIn()
        }
      }
      catch {
        // 保留本地 token，交给后续请求的 refresh 流程
      }
    }
  }
  finally {
    // 先拿到皮肤/活动状态再放行首屏：活动皮肤的开场画面要覆盖在站点首帧之上，
    // 避免先闪一下默认皮肤。接口异常最多等 0.9s，不会长时间阻塞进入。
    await Promise.race([
      refreshThemeState(),
      new Promise(resolve => setTimeout(resolve, 900)),
    ])
    isUserReady.value = true
    void checkCustomTitleModal()
  }
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>

<template>
  <SkinBackground />
  <SkinDecorLayer />
  <router-view v-if="isUserReady" />
  <TitleCustomizeModal v-if="showTitleModal" @saved="onTitleSaved" />
  <!-- 全局音乐播放器：跨路由续播，挂在 router-view 之外 -->
  <PlayerBar />
  <NowPlayingOverlay />
  <PlaylistDrawer />
  <FestivalSplash />
  <SkinShareAddDialog />
</template>
