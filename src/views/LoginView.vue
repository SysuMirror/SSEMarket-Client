<script setup lang="ts">
import type { CustomFormData } from '@/composables/FormExam'

import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getInfo } from '@/api/info/getInfo'
import { userLogin } from '@/api/LoginAndRegister/login'
import { reportDailyVisit } from '@/api/coin/coin'
import { onSsoProbeSettled, ssoMode, ssoTry } from '@/api/sso/sso'
import FormContainer from '@/components/FormContainer.vue'
import { showMsg } from '@/components/MessageBox'

import { useUserStore } from '@/store/userStore'

const route = useRoute()
const router = useRouter()
const { token, refreshToken, setToken, setRefreshToken, setUserInfo } = useUserStore()

const fallbackNotice = ref(false)
const modeError = ref('')
/** 用户开始输入表单后，晚到的静默成功不再自动跳转（交给密码登录）。 */
const userTyped = ref(false)

const ssoErrorTexts: Record<string, string> = {
  state: '登录状态已过期或已使用，请重新发起统一登录',
  exchange: '统一登录服务暂时不可用，请稍后重试',
  conflict: '该统一身份已绑定其他集市账号',
  internal: '该账号没有软件工程学院内部权限，无法登录集市',
}

const form = ref<CustomFormData[]>([
  {
    id: 'email',
    label: '邮箱',
    value: '',
    type: 'email',
    autocomplete: 'email',
  },
  {
    id: 'password',
    label: '密码',
    value: '',
    type: 'password',
    autocomplete: 'current-password',
  },
])

const rememberMe = ref(true)

async function loginHandler() {
  const email = form.value[0].value
  const password = form.value[1].value
  if (!email.trim() || !password.trim()) {
    showMsg('请填写完整信息')
    return
  }
  try {
    const result = await userLogin(email, password)
    if (!result) {
      showMsg('登录失败')
      return
    }
    if (rememberMe.value) {
      localStorage.setItem('rememberMe', 'true')
    }
    else {
      localStorage.removeItem('rememberMe')
    }
    setToken(result.token)
    setRefreshToken(result.refresh_token)
    const info = await getInfo()
    setUserInfo(info)
    // 每日进入网页 +1 币（后端按日期幂等，重复登录不会重复发）
    void reportDailyVisit()
  }
  catch (error) {
    console.error('登录失败', error)
    showMsg(error instanceof Error && error.message ? error.message : '登录失败')
  }
}

function redirectTarget(): string {
  const query = route.query
  const redirect = typeof query.redirect === 'string' ? query.redirect : ''
  if (!(redirect.startsWith('/') && !redirect.startsWith('//')))
    return '/'
  // 守卫把深链拆成 redirect + 其余 query 键（如 /connect 的 appid/redirect_uri/
  // scope/response_type/state）。只回 redirect 会丢参数，这里补回来（同 AuthLayout）。
  const otherParams = new URLSearchParams()
  for (const key in query) {
    if (key === 'redirect' || key === 'error')
      continue
    const value = query[key]
    if (typeof value === 'string' && value)
      otherParams.append(key, value)
  }
  if (!otherParams.toString())
    return redirect
  return `${redirect}${redirect.includes('?') ? '&' : '?'}${otherParams.toString()}`
}

/** 已有本地会话或共享 Cookie 能静默兑换时，直接进入登录态；否则留在表单。 */
async function tryAutoLogin(): Promise<boolean> {
  if (token.value || refreshToken.value) {
    const info = await getInfo()
    if (info && info.userID && info.userID !== 0) {
      setUserInfo(info)
      void reportDailyVisit()
      return true
    }
  }
  const silent = await ssoTry()
  if (silent.state !== 'ok')
    return false
  setToken(silent.token)
  setRefreshToken(silent.refresh_token)
  const info = await getInfo()
  setUserInfo(info)
  void reportDailyVisit()
  return true
}

watch(
  () => [form.value[0].value, form.value[1].value],
  () => {
    userTyped.value = true
  },
)

onMounted(async () => {
  const error = typeof route.query.error === 'string' ? route.query.error : ''
  if (error) {
    modeError.value = ssoErrorTexts[error] ?? '统一登录失败，请重试'
  }
  // 慢链路下静默探测可能晚于 UI 上界才成功：落定后若用户尚未开始输入，自动进入登录态，
  // 免去"首访停在登录页、手动刷新才登录"的时序竞态（同 iwiki 加固）。
  const stopSsoLate = onSsoProbeSettled(async (result) => {
    if (result.state !== 'ok' || userTyped.value || token.value || refreshToken.value)
      return
    if (!route.path.startsWith('/auth'))
      return
    try {
      setToken(result.token)
      setRefreshToken(result.refresh_token)
      const info = await getInfo()
      if (info && info.userID && info.userID !== 0) {
        setUserInfo(info)
        void reportDailyVisit()
        router.replace(redirectTarget())
      }
    }
    catch {
      // 兑换/取用户信息失败：留在登录表单，交给密码登录
    }
  })
  onUnmounted(() => stopSsoLate())
  // 进入登录页先试静默 SSO（共享父域 Cookie），成功则无跳转直接进入已登录态。
  if (await tryAutoLogin()) {
    router.replace(redirectTarget())
    return
  }
  // 登录无感：主模式同一表单，密码由后端转 unisso M2M 校验；仅在探测判定故障时提示兜底。
  const info = await ssoMode()
  if (info && info.mode === 'fallback') {
    fallbackNotice.value = true
  }
})
</script>

<template>
  <FormContainer
    title="欢迎回来"
    :subtitle="fallbackNotice ? '统一身份服务暂不可用，已启用本地登录兜底' : '使用邮箱登录你的账号'"
    form-name="登录"
    :form-data="form"
    @submit-form="loginHandler"
  >
    <p v-if="modeError" class="auth-sso__error">
      {{ modeError }}
    </p>
    <label class="auth-row auth-check">
      <input v-model="rememberMe" type="checkbox" class="auth-check__input">
      <span class="auth-check__text">记住我</span>
    </label>
    <p v-if="fallbackNotice" class="auth-sso__hint">
      统一身份服务暂时不可用，本次登录使用本地密码校验。恢复后将自动切回统一校验。
    </p>
    <div class="auth-links">
      <router-link class="auth-link" to="/auth/register">
        注册账号
      </router-link>
      <span class="auth-links__sep" aria-hidden="true">·</span>
      <router-link class="auth-link" to="/auth/reset">
        忘记密码
      </router-link>
    </div>
  </FormContainer>
</template>

<style scoped lang="scss">
.auth-sso__hint {
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--chat-text-secondary);
}

.auth-sso__error {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #d9534f;
}

.auth-row {
  margin-top: 0.5rem;
}

.auth-check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--chat-text-secondary);
  user-select: none;
}

.auth-check__input {
  width: 1rem;
  height: 1rem;
  accent-color: var(--chat-accent);
  cursor: pointer;
}

.auth-check__text {
  line-height: 1.4;
}

.auth-links {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
  margin-top: 1rem;
  font-size: 0.875rem;
}

.auth-links__sep {
  color: var(--chat-border-strong);
  user-select: none;
}

.auth-link {
  color: var(--chat-accent);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.auth-link:hover {
  color: var(--chat-text);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
</style>
