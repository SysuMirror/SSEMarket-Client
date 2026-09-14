<script setup lang="ts">
import type { CustomFormData } from '@/composables/FormExam'

import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getInfo } from '@/api/info/getInfo'
import { ssoBind } from '@/api/sso/sso'
import FormContainer from '@/components/FormContainer.vue'
import { showMsg } from '@/components/MessageBox'
import { useFormExam } from '@/composables/FormExam'
import { useUserStore } from '@/store/userStore'

const route = useRoute()
const router = useRouter()
const { setToken, setRefreshToken, setUserInfo } = useUserStore()

const ticket = typeof route.query.ticket === 'string' ? route.query.ticket : ''
const ssoEmail = typeof route.query.sso_email === 'string' ? route.query.sso_email : ''
const ssoUsername = typeof route.query.sso_username === 'string' ? route.query.sso_username : ''

const form = ref<CustomFormData[]>([
  {
    id: 'email',
    label: '集市账号邮箱',
    value: ssoEmail,
    type: 'email',
    autocomplete: 'email',
  },
  {
    id: 'password',
    label: '集市账号密码',
    value: '',
    type: 'password',
    autocomplete: 'current-password',
  },
])

const { correct } = useFormExam(form)
const busy = ref(false)

async function bindHandler() {
  const email = form.value[0].value
  const password = form.value[1].value
  if (!email || !password) {
    showMsg('请输入邮箱与密码')
    return
  }
  if (!ticket) {
    showMsg('绑定凭证已失效，请重新发起 SSO 登录')
    router.replace('/auth/login')
    return
  }
  busy.value = true
  try {
    const tokens = await ssoBind(ticket, email, password)
    if (!tokens)
      return
    localStorage.setItem('rememberMe', 'true')
    setToken(tokens.token)
    setRefreshToken(tokens.refresh_token)
    const info = await getInfo()
    setUserInfo(info)
    showMsg('绑定成功，已登录')
    router.replace('/')
  }
  catch (error) {
    showMsg(error instanceof Error ? error.message : '绑定失败')
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <FormContainer
    title="绑定集市账号"
    :subtitle="`当前 SSO 身份：${ssoUsername || ssoEmail || '未知'}`"
    form-name="验证并绑定"
    :form-data="form"
    :disabled="!correct || busy"
    @submit-form="bindHandler"
  >
    <p class="sso-bind__hint">
      输入已注册的集市账号邮箱与密码，验证通过即完成绑定并登录。
    </p>
    <p class="sso-bind__hint">
      还没有账号？
      <router-link class="sso-bind__link" to="/auth/register">
        先注册
      </router-link>
      ，注册后可在「设置 → 账号绑定」中绑定此 SSO。
    </p>
  </FormContainer>
</template>

<style scoped lang="scss">
.sso-bind__hint {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: var(--chat-text-secondary);
  line-height: 1.5;
}

.sso-bind__link {
  color: var(--chat-accent);
  text-decoration: none;
  font-weight: 500;
}

.sso-bind__link:hover {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
</style>
