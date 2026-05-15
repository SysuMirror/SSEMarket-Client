<!-- eslint-disable regexp/no-super-linear-backtracking -->
<script lang="ts" setup>
import type { CustomFormData } from '@/composables/FormExam'
import { computed, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import { getInfo } from '@/api/info/getInfo'
import { userRegister } from '@/api/LoginAndRegister/register'

import { sendCode } from '@/api/LoginAndRegister/utils'
import FormContainer from '@/components/FormContainer.vue'

import { showMsg } from '@/components/MessageBox.jsx'
import { useFormExam } from '@/composables/FormExam'
import { useUserStore } from '@/store/userStore'

const router = useRouter()
const { setToken, setRefreshToken, setUserInfo } = useUserStore()
const rememberMe = useTemplateRef('rememberMe')

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
  color: #636366;
  user-select: none;
}

.auth-check__input {
  width: 1rem;
  height: 1rem;
  accent-color: #6b6a68;
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
  color: #aeaeb2;
  line-height: 1.35;
}

.auth-link {
  flex-shrink: 0;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b6a68;
  text-decoration: none;
  transition: color 0.2s ease;
  padding-top: 0.125rem;
}

.auth-link:hover {
  color: #3a3a3c;
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
  border: 1px solid #d1d1d6;
  border-radius: 0.625rem;
  background: #fff;
  font-size: 0.9375rem;
  font-weight: 500;
  color: #3a3a3c;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.auth-btn-secondary:hover:not(:disabled) {
  background: #f2f2f7;
  border-color: #c7c7cc;
}

.auth-btn-secondary:disabled {
  color: #aeaeb2;
  border-color: #e5e5ea;
  background: #fafafa;
  cursor: not-allowed;
}
</style>
