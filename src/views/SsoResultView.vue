<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getInfo } from '@/api/info/getInfo'
import { ssoExchange } from '@/api/sso/sso'
import { showMsg } from '@/components/MessageBox'
import { useUserStore } from '@/store/userStore'

const route = useRoute()
const router = useRouter()
const { setToken, setRefreshToken, setUserInfo } = useUserStore()
const ready = ref(false)

const errorTexts: Record<string, string> = {
  state: '登录状态已过期或已使用，请重新发起统一登录',
  exchange: '统一登录服务暂时不可用，请稍后重试',
  conflict: '该统一身份已绑定其他集市账号',
  internal: '该账号没有软件工程学院内部权限，无法登录集市',
}

async function enterMarket(token: string, refreshToken: string, bound: boolean) {
  localStorage.setItem('rememberMe', 'true')
  setToken(token)
  setRefreshToken(refreshToken)
  const info = await getInfo()
  setUserInfo(info)
  if (bound)
    showMsg('SSO 绑定成功')
  router.replace('/')
}

onMounted(async () => {
  const ticket = typeof route.query.ticket === 'string' ? route.query.ticket : ''
  const error = typeof route.query.error === 'string' ? route.query.error : ''

  if (error) {
    showMsg(errorTexts[error] ?? '统一登录失败，请重试')
    router.replace({ path: '/auth/login', query: { error } })
    ready.value = true
    return
  }
  if (!ticket) {
    router.replace('/auth/login')
    ready.value = true
    return
  }

  const result = await ssoExchange(ticket)
  if (!result) {
    showMsg('登录凭证无效或已过期，请重新发起统一登录')
    router.replace({ path: '/auth/login', query: { manual: '1' } })
    ready.value = true
    return
  }

  if (result.type === 'bind_needed') {
    router.replace({
      path: '/auth/sso/bind',
      query: {
        ticket,
        sso_email: result.sso_email ?? '',
        sso_username: result.sso_username ?? '',
      },
    })
    ready.value = true
    return
  }

  if (result.token && result.refresh_token) {
    await enterMarket(result.token, result.refresh_token, result.type === 'bound')
  }
  else {
    showMsg('统一登录失败，请重试')
    router.replace({ path: '/auth/login', query: { manual: '1' } })
  }
  ready.value = true
})
</script>

<template>
  <div class="sso-result">
    <p class="sso-result__text">
      正在处理 SSO 登录结果…
    </p>
  </div>
</template>

<style scoped lang="scss">
.sso-result {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  color: var(--chat-text-secondary);
}

.sso-result__text {
  font-size: 0.9375rem;
}
</style>
