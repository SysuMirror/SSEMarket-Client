<script setup lang="ts">
import type { CustomFormData } from '@/composables/FormExam'
import { computed, onMounted, ref } from 'vue'

import { useRouter } from 'vue-router'
import { updatePassword } from '@/api/LoginAndRegister/forgetPwd'
import { sendCode } from '@/api/LoginAndRegister/utils'
import { ssoMode } from '@/api/sso/sso'
import FormContainer from '@/components/FormContainer.vue'
import { showMsg } from '@/components/MessageBox'
import { useFormExam } from '@/composables/FormExam'

const router = useRouter()

// 统一身份模式下密码由 UniSSO 管理，本地改密会造成两边密码不一致、登录被拒。
// 只有 SSO 整体停用（disabled）时才保留集市本地找回密码页。
onMounted(async () => {
  const info = await ssoMode()
  if (info && info.mode !== 'disabled')
    window.location.replace('https://sso.ssemarket.cn/reset-password')
})

const form = ref<CustomFormData[]>([
  {
    id: 'email',
    value: '',
    label: '邮箱',
    type: 'email',
    autocomplete: 'email',
    reg: /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\])|(([a-z\-0-9]+\.)+[a-z]{2,}))$/i,
  },
  {
    id: 'password',
    value: '',
    label: '新密码',
    type: 'password',
    autocomplete: 'new-password',
    reg: /^(?![a-zA-Z]+$)(?![A-Z0-9]+$)(?![A-Z\W_]+$)(?![a-z0-9]+$)(?![a-z\W_]+$)(?![0-9\W_]+$)[\s\S]{8,12}/,
  },
  {
    id: 'password2',
    value: '',
    label: '确认新密码',
    type: 'password',
    reg: /^(?![a-zA-Z]+$)(?![A-Z0-9]+$)(?![A-Z\W_]+$)(?![a-z0-9]+$)(?![a-z\W_]+$)(?![0-9\W_]+$)[\s\S]{8,12}/,
  },
  {
    id: 'code',
    value: '',
    label: '验证码',
  },
])

const { correct } = useFormExam(form)

const passwordCorrect = computed(() => {
  return (
    form.value[1].reg?.test(form.value[1].value)
    && form.value[1].value === form.value[2].value
  )
})
const emailCorrect = computed(() => {
  return form.value[0].reg?.test(form.value[0].value)
})

async function resetHandler() {
  const email = form.value[0].value
  const password1 = form.value[1].value
  const password2 = form.value[2].value
  const code = form.value[3].value
  if (
    email
    && password1
    && password2
    && code
  ) {
    try {
      const res = await updatePassword(
        email,
        password1,
        password2,
        code,
      )
      if (res.code !== 200) {
        showMsg(res.msg)
        return
      }
      showMsg('重置密码成功')
      router.push('/auth/login')
    }
    catch (e) {
      console.error(e)
      showMsg('重置密码失败，请稍后再试')
    }
  }
  else {
    showMsg('不要输入空白信息')
  }
}

async function sendVerificationCode() {
  const email = form.value[0].value
  if (!email)
    return
  const res = await sendCode(email, 1)
  if (res.code !== 200) {
    showMsg(res.msg)
    return
  }
  showMsg('验证码已发送')
}
</script>

<template>
  <FormContainer
    title="重置密码"
    subtitle="验证邮箱后设置新密码"
    form-name="确认重置"
    :form-data="form"
    :disabled="!correct || !passwordCorrect"
    @submit-form="resetHandler"
  >
    <p class="reset-hint" :class="passwordCorrect ? 'reset-hint--ok' : 'reset-hint--warn'">
      {{
        passwordCorrect
          ? '密码格式与两次输入已符合要求'
          : '密码需含大小写字母、数字与特殊字符，长度 8–12 位，且两次输入一致'
      }}
    </p>
    <div class="reset-footer">
      <router-link class="auth-link" to="/auth/login">
        返回登录
      </router-link>
    </div>
    <button
      type="button"
      :disabled="!emailCorrect"
      class="auth-btn-secondary"
      @click="sendVerificationCode"
    >
      {{ emailCorrect ? '发送验证码' : '请先填写有效邮箱' }}
    </button>
  </FormContainer>
</template>

<style scoped lang="scss">
.reset-hint {
  margin: 1rem 0 0;
  text-align: center;
  font-size: 0.8125rem;
  line-height: 1.55;
  color: #8e8e93;
}

.reset-hint--ok {
  color: #5f7a6e;
}

.reset-hint--warn {
  color: #8b7a78;
}

.reset-footer {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.auth-link {
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b6a68;
  text-decoration: none;
  transition: color 0.2s ease;
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
