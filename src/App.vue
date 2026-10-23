<script setup lang="ts">
import {
  onBeforeMount,
  onUnmounted,
  ref,
} from 'vue'
import { getInfo, getSelfAllInfo } from './api/info/getInfo'
import { userLogin } from './api/LoginAndRegister/login'
import { reportDailyVisit } from './api/coin/coin'
import { useUserStore } from './store/userStore'

import TitleCustomizeModal from '@/components/TitleCustomizeModal.vue'
import NowPlayingOverlay from '@/components/music/NowPlayingOverlay.vue'
import PlayerBar from '@/components/music/PlayerBar.vue'
import PlaylistDrawer from '@/components/music/PlaylistDrawer.vue'
import FestivalSplash from '@/components/skin/FestivalSplash.vue'
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
  const hasLegacyCreds = !!(localStorage.email && localStorage.password)
  const hasToken = !!token.value
  const hasRefreshToken = !!refreshToken.value

  try {
    // 过渡到双Token制用
    if (hasLegacyCreds && !hasToken && !hasRefreshToken) {
      try {
        const email = localStorage.email
        const password = localStorage.password
        if (email && password) {
          const result = await userLogin(email, password)
          if (result) {
            localStorage.setItem('rememberMe', 'true')

            setToken(result.token)
            setRefreshToken(result.refresh_token)
            const info = await getInfo()
            if (info && info.userID && info.userID !== 0)
              setUserInfo(info)

            localStorage.removeItem('email')
            localStorage.removeItem('password')
            reportVisitIfLoggedIn()
            return
          }
        }
      }
      catch (e) {
        console.error('兼容旧版本自动登录失败', e)
      }
      // 登录失败时保留，用户仍可手动登录
    }

    if (hasToken || hasRefreshToken) {
      try {
        const info = await getInfo()
        if (info && info.userID && info.userID !== 0) {
          setUserInfo(info)
          reportVisitIfLoggedIn()
        }
      }
      catch {
        // 优先使用 refresh_token 静默续期
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
</template>
