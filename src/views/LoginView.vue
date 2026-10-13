<script setup lang="ts">
import type { CustomFormData } from '@/composables/FormExam'

import { ref } from 'vue'

import { getInfo } from '@/api/info/getInfo'
import { userLogin } from '@/api/LoginAndRegister/login'
import { reportDailyVisit } from '@/api/coin/coin'
import { ssoLoginURL } from '@/api/sso/sso'
import FormContainer from '@/components/FormContainer.vue'
import { showMsg } from '@/components/MessageBox'

import { useUserStore } from '@/store/userStore'

const { setToken, setRefreshToken, setUserInfo } = useUserStore()

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
    if (email && password) {
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
  }
  catch (error) {
    console.error('登录失败', error)
    showMsg('登录失败')
  }
}

function gotoSSOLogin() {
  window.location.href = ssoLoginURL()
}
</script>

<template>
  <FormContainer
    title="欢迎回来"
    subtitle="使用邮箱登录你的账号"
    form-name="登录"
    :form-data="form"
    @submit-form="loginHandler"
  >
    <label class="auth-row auth-check">
      <input v-model="rememberMe" type="checkbox" class="auth-check__input">
      <span class="auth-check__text">记住我</span>
    </label>
    <div class="auth-links">
      <router-link class="auth-link" to="/auth/register">
        注册账号
      </router-link>
      <span class="auth-links__sep" aria-hidden="true">·</span>
      <router-link class="auth-link" to="/auth/reset">
        忘记密码
      </router-link>
    </div>
    <div class="auth-sso">
      <button type="button" class="auth-sso__btn" @click="gotoSSOLogin">
        使用 UniSSO 登录
      </button>
    </div>
  </FormContainer>
</template>

<style scoped lang="scss">
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

.auth-sso {
  margin-top: 1rem;
  display: flex;
  justify-content: center;
}

.auth-sso__btn {
  padding: 0.55rem 1.1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--chat-text);
  background: transparent;
  border: 1px solid var(--chat-border-strong);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.auth-sso__btn:hover {
  border-color: var(--chat-accent);
  color: var(--chat-accent);
}
</style>
