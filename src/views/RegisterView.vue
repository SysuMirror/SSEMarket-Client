<!-- eslint-disable regexp/no-super-linear-backtracking -->
<script lang="ts" setup>
import type { CustomFormData } from '@/composables/FormExam'
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getInfo } from '@/api/info/getInfo'
import { userRegister } from '@/api/LoginAndRegister/register'

import { sendCode } from '@/api/LoginAndRegister/utils'
import { ssoMode } from '@/api/sso/sso'
import FormContainer from '@/components/FormContainer.vue'

import { showMsg } from '@/components/MessageBox'
import { useFormExam } from '@/composables/FormExam'
import { useUserStore } from '@/store/userStore'

const route = useRoute()
const router = useRouter()
const { setToken, setRefreshToken, setUserInfo } = useUserStore()
const rememberMe = useTemplateRef('rememberMe')

// 注册完成后的回跳地址：优先沿用登录守卫留下的 redirect 深链，否则回集市首页。
// router.resolve 会带上应用基路径（/new/），new URL 再补成绝对地址，交给 UniSSO 校验。
function marketReturnURL(): string {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  const target = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/'
  return new URL(router.resolve(target).href, window.location.origin).href
}

// 统一身份模式下注册只在 sso.ssemarket.cn/register 完成（UniSSO 会回调集市建号）。
// 集市本地注册页保留仅用于 SSO 整体停用（disabled）的场景。
onMounted(async () => {
  const info = await ssoMode()
  if (info && info.mode !== 'disabled') {
    const params = new URLSearchParams({ redirect_uri: marketReturnURL() })
    window.location.replace(`https://sso.ssemarket.cn/register?${params.toString()}`)
  }
})

// const passwordReg = /^\S*(?=\S{6})(?=\S*\d)(?=\S*[A-Z])(?=\S*[a-z])(?=\S*[!@#$%^&*? ])\S+$/

const registerForm = ref<CustomFormData[]>([
  {
    id: 'username',
    value: '',
    label: '用户名',
    autocomplete: 'username',
  },
  {
    id: 'email',
    value: '',
    label: '邮箱',
    type: 'email',
    autocomplete: 'email',
  },
  {
    id: 'password',
    value: '',
    label: '密码',
    type: 'password',
    // reg: passwordReg,
    autocomplete: 'new-password',
  },
  {
    id: 'password2',
    value: '',
    label: '确认密码',
    // reg: passwordReg,
    type: 'password',
  },
  {
    id: 'v_code',
    value: '',
    label: '验证码',
  },
  {
    id: 'cd_key',
    value: '',
    label: '邀请码',
  },
])

const emailIsCorrect = computed(() => {
  const email = registerForm.value[1].value
  const reg = /^[\w.%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
  return reg.test(email)
})

const { correct } = useFormExam(registerForm)

// const passwordIsCorrect = computed(() => {
//   const password = registerForm.value[2].value
//   const password2 = registerForm.value[3].value
//   return password === password2 && passwordReg.test(password)
// })

async function sendCodeAction() {
  const email = registerForm.value[1].value
  if (!emailIsCorrect.value) {
    return
  }
  const data = await sendCode(email, 0)
  if (!data) {
    return
  }
  showMsg('验证码发送成功，请注意查收')
}

async function registerAction() {
  if (!correct.value) {
    return
  }

  const name = registerForm.value[0].value
  const email = registerForm.value[1].value
  const password = registerForm.value[2].value
  const password2 = registerForm.value[3].value
  const vcode = registerForm.value[4].value.trim() // 去除前后空格
  const cd_key = registerForm.value[5].value.trim() // 去除前后空格

  try {
    const resp = await userRegister(cd_key, email, name, password, password2, vcode)
    if (resp.code !== 200) {
      showMsg(resp.msg)
      return
    }

    const token = resp.data?.token
    const refreshToken = resp.data?.refresh_token
    if (!token || !refreshToken) {
      showMsg('注册成功，但登录信息异常，请手动登录')
      router.push('/auth/login')
      return
    }

    if (rememberMe.value?.checked) {
      localStorage.setItem('rememberMe', 'true')
    }
    else {
      localStorage.removeItem('rememberMe')
    }

    setToken(token)
    setRefreshToken(refreshToken)

    try {
      const info = await getInfo()
      setUserInfo(info)
    }
    catch (e) {
      console.error('获取用户信息失败', e)
    }

    showMsg('注册成功，已自动登录')
    router.push('/')
  }
  catch (error) {
    console.error('Register failed:', error)
    showMsg('注册失败，请稍后再试')
  }
}
</script>

<template>
  <FormContainer
    title="创建账号"
    subtitle="填写信息完成注册，验证码将发送至邮箱"
    form-name="注册"
    :form-data="registerForm"
    :disabled="!correct"
    @submit-form="registerAction"
  >
    <div class="reg-toolbar">
      <label class="auth-check">
        <input ref="rememberMe" type="checkbox" class="auth-check__input">
        <span class="auth-check__text">记住我</span>
        <span class="auth-check__hint">下次自动登录</span>
      </label>
      <RouterLink class="auth-link" to="/auth/login">
        已有账号
      </RouterLink>
    </div>
    <button
      type="button"
      :disabled="!emailIsCorrect"
      class="auth-btn-secondary"
      @click.prevent="sendCodeAction"
    >
      {{ emailIsCorrect ? '发送验证码' : '请先填写有效邮箱' }}
    </button>
  </FormContainer>
</template>

<style scoped lang="scss">
.reg-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.25rem;
}

.auth-check {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
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

.auth-check__hint {
  width: 100%;
  flex-basis: 100%;
  margin-left: 1.5rem;
  font-size: 0.8125rem;
  color: var(--chat-text-tips);
  line-height: 1.35;
}

.auth-link {
  flex-shrink: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--chat-accent);
  text-decoration: none;
  transition: color 0.2s ease;
  padding-top: 0.125rem;
}

.auth-link:hover {
  color: var(--chat-text);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.auth-btn-secondary {
  margin-top: 1rem;
  width: 100%;
  height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--chat-border-strong);
  border-radius: 0.625rem;
  background: var(--chat-bg-elevated);
  font-size: 0.9375rem;
  font-weight: 600;
  font-family: inherit;
  text-transform: none;
  letter-spacing: 0.02em;
  color: var(--chat-text);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.auth-btn-secondary:hover:not(:disabled) {
  background: var(--chat-bg-main);
  border-color: var(--chat-accent);
  color: var(--chat-accent);
}

.auth-btn-secondary:disabled {
  color: var(--chat-text-tips);
  border-color: var(--chat-border);
  background: var(--chat-bg-main);
  cursor: not-allowed;
}
</style>
