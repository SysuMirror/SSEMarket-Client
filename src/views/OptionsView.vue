<script setup lang="ts">
import type { AllInfo } from '@/api/info/getInfo'
import type { Ref } from 'vue'
import { computed, inject, onMounted, ref, useTemplateRef, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import { getAllInfo } from '@/api/info/getInfo'
import { updateEmailPush, updateUserInfo, uploadAvatar } from '@/api/info/updateInfo'
import { updatePassword } from '@/api/LoginAndRegister/forgetPwd'
import { sendCode } from '@/api/LoginAndRegister/utils'
import { showMsg } from '@/components/MessageBox'
import { usePWA } from '@/composables/usePWA'
import { useUserStore } from '@/store/userStore'
import {
  levelClassHandler,
  levelExpHandler,
  levelNameHandler,
} from '@/utils/level'

const router = useRouter()
const isPC = inject('isPC', ref(false)) as Ref<boolean>
const { userInfo, setToken, setRefreshToken } = useUserStore()
const { pwaExperienceEnabled } = usePWA()

const allInfo = ref<AllInfo>({
  avatarURL: '',
  ban: '',
  email: '',
  emailpush: false,
  intro: '',
  name: '',
  phone: '',
  punishnum: 0,
  score: 0,
  userID: 0,
  hideProfilePosts: false,
})

const VCode = useTemplateRef('VCode')
const password1 = useTemplateRef('password1')
const password2 = useTemplateRef('password2')

const isPushDisabled = ref(false)
const hidePostsSyncing = ref(false)
const defaultAvatar = `${import.meta.env.BASE_URL}default-avatar.svg`
const settingsAvatarSrc = ref(defaultAvatar)

const expTarget = computed(() => {
  const s = allInfo.value?.score ?? 0
  const n = Number.parseInt(levelExpHandler(s), 10)
  return Number.isFinite(n) && n > 0 ? n : 1
})

const expPercent = computed(() => {
  const s = allInfo.value?.score ?? 0
  return Math.min(100, Math.round((s / expTarget.value) * 1000) / 10)
})

const nextLevelLabel = computed(() => {
  const s = allInfo.value?.score ?? 0
  return levelNameHandler(Number.parseInt(levelExpHandler(s), 10))
})

watch(
  () => allInfo.value?.avatarURL,
  (u) => {
    settingsAvatarSrc.value = (u && u.trim()) ? u : defaultAvatar
  },
  { immediate: true },
)

function onSettingsAvatarError() {
  if (settingsAvatarSrc.value !== defaultAvatar)
    settingsAvatarSrc.value = defaultAvatar
}

/** 将当前表单同步到服务器（头像 / 隐藏发帖开关会即时调用） */
async function persistUserInfoToServer(): Promise<void> {
  if (!allInfo.value)
    throw new Error('no info')
  if (/^\s+|\s+$/.test(allInfo.value.name)) {
    showMsg('用户名不能以空格作为开头或者结尾')
    throw new Error('name')
  }
  const res = await updateUserInfo(
    allInfo.value.avatarURL,
    allInfo.value.intro,
    allInfo.value.name,
    allInfo.value.userID,
    !!allInfo.value.hideProfilePosts,
  )
  if (res == null) {
    showMsg('网络异常，保存失败')
    throw new Error('api')
  }
  if (res.msg)
    showMsg(res.msg)
}

async function codeHandler() {
  try {
    if (!allInfo.value)
      return
    const data = await sendCode(allInfo.value.email, 1)
    if (!data)
      return
    showMsg('验证码发过去啦')
  }
  catch (e) {
    showMsg('发送验证码失败')
    console.error(e)
  }
}

async function updatePasswordFunc() {
  if (!password1.value || !password2.value || !VCode.value)
    return
  if (password1.value.value === '' || password2.value.value === '') {
    showMsg('密码不能为空')
    return
  }
  if (password1.value.value !== password2.value.value) {
    showMsg('两次密码不一致')
    return
  }
  try {
    const res = await updatePassword(
      userInfo.email,
      password1.value.value,
      password2.value.value,
      VCode.value.value,
    )
    showMsg(res.msg)
  }
  catch (e) {
    showMsg('更新密码失败')
    console.error(e)
  }
}

async function uploadAvatarFunc(e: Event) {
  const el = e.target as HTMLInputElement
  try {
    if (!allInfo.value)
      return
    const file = el.files?.[0]
    if (!file)
      return
    const res = await uploadAvatar(file)
    allInfo.value.avatarURL = res.data.avatar_url
    try {
      await persistUserInfoToServer()
    }
    catch {
      showMsg('头像已上传，但资料未同步：请检查用户名后点「保存资料」')
    }
  }
  catch (e) {
    console.error(e)
    showMsg('失败了:-(')
  }
  finally {
    if (el)
      el.value = ''
  }
}

async function updateUserInfoFunc() {
  try {
    await persistUserInfoToServer()
  }
  catch {
    // 错误已在 persist 内提示
  }
}

function logout() {
  if (confirm('确定要退出登录吗')) {
    localStorage.removeItem('userInfo')
    localStorage.removeItem('token')
    localStorage.removeItem('email')
    localStorage.removeItem('password')
    localStorage.removeItem('rememberMe')
    setToken('')
    setRefreshToken('')
    router.push('/')
    window.location.reload()
  }
}

onMounted(async () => {
  allInfo.value = await getAllInfo(userInfo.phone)
  isPushDisabled.value = allInfo.value.emailpush
})

async function togglePush() {
  try {
    if (!allInfo.value)
      return
    await updateEmailPush(allInfo.value.userID)
    isPushDisabled.value = !isPushDisabled.value
    showMsg(`邮件推送已${isPushDisabled.value ? '启用' : '禁用'}`)
  }
  catch (e) {
    console.error(e)
    showMsg('失败了')
  }
}

function togglePWAExperience() {
  pwaExperienceEnabled.value = !pwaExperienceEnabled.value
  showMsg(`电脑端样式新体验已${pwaExperienceEnabled.value ? '启用' : '关闭'}`)
}

async function toggleHideProfile() {
  if (!allInfo.value || hidePostsSyncing.value)
    return
  const prev = !!allInfo.value.hideProfilePosts
  allInfo.value.hideProfilePosts = !prev
  hidePostsSyncing.value = true
  try {
    await persistUserInfoToServer()
  }
  catch {
    allInfo.value.hideProfilePosts = prev
    showMsg('同步失败，已恢复原设置')
  }
  finally {
    hidePostsSyncing.value = false
  }
}
</script>

<template>
  <div class="options-page">
    <header class="options-page__head">
      <div class="options-page__title-row">
        <Icon icon="tabler:settings" class="options-page__title-icon" width="22" height="22" aria-hidden="true" />
        <h1 class="options-page__title">
          设置
        </h1>
      </div>
      <p class="options-page__subtitle">
        个人信息与账号安全
      </p>
    </header>

    <!-- 账号概览 -->
    <section class="options-sheet" aria-label="账号概览">
      <div class="options-identity">
        <div class="options-identity__avatar-wrap">
          <img
            class="options-identity__avatar"
            :src="settingsAvatarSrc"
            alt="头像"
            loading="lazy"
            @error="onSettingsAvatarError"
          >
        </div>
        <div class="options-identity__main">
          <p class="options-overline">
            当前账号
          </p>
          <p class="options-identity__name">
            {{ allInfo.name || '未设置昵称' }}
          </p>
          <div class="options-kv options-kv--inline">
            <span class="options-kv__k">手机</span>
            <span class="options-kv__v">{{ allInfo.phone || '—' }}</span>
          </div>
          <div class="options-kv options-kv--inline">
            <span class="options-kv__k">邮箱</span>
            <span class="options-kv__v options-kv__v--truncate">{{ allInfo.email || '—' }}</span>
          </div>
        </div>
      </div>

      <label class="options-btn options-btn--secondary options-btn--full options-btn--file">
        <Icon icon="tabler:camera" width="18" height="18" aria-hidden="true" />
        更换头像
        <input
          type="file"
          accept="image/*"
          class="options-file-input"
          @change="uploadAvatarFunc"
        >
      </label>

      <div class="options-divider" />

      <p class="options-overline">
        经验与等级
      </p>
      <div class="options-exp-head">
        <span class="options-level-badge" :class="levelClassHandler(allInfo.score || 0)">
          {{ levelNameHandler(allInfo.score || 0) }}
        </span>
        <span class="options-exp-num">{{ allInfo.score ?? 0 }} / {{ expTarget }}</span>
        <span class="options-level-badge options-level-badge--muted">{{ nextLevelLabel }}</span>
      </div>
      <div class="options-progress-track" role="progressbar" :aria-valuenow="expPercent" aria-valuemin="0" aria-valuemax="100">
        <div class="options-progress-fill" :style="{ width: `${expPercent}%` }" />
      </div>
    </section>

    <!-- 编辑资料 -->
    <section class="options-sheet" aria-label="编辑资料">
      <p class="options-overline">
        资料
      </p>
      <label class="options-field">
        <span class="options-field__label">用户名</span>
        <input v-model="allInfo.name" type="text" class="options-input" autocomplete="nickname" placeholder="展示名称">
      </label>
      <label class="options-field">
        <span class="options-field__label">个人简介</span>
        <input v-model="allInfo.intro" type="text" class="options-input" autocomplete="off" placeholder="一句话介绍自己">
      </label>

      <div class="options-row-toggle" role="group" aria-label="主页发帖可见性">
        <div class="options-row-toggle__text">
          <span class="options-row-toggle__title">在个人主页对其他人隐藏发帖</span>
          <span class="options-row-toggle__hint">开启后仅本人可见历史发帖；变更会立即同步</span>
        </div>
        <button
          type="button"
          class="options-switch"
          :class="{ 'options-switch--on': allInfo.hideProfilePosts }"
          :disabled="hidePostsSyncing"
          role="switch"
          :aria-checked="!!allInfo.hideProfilePosts"
          @click="toggleHideProfile"
          @keydown.enter.prevent="toggleHideProfile"
          @keydown.space.prevent="toggleHideProfile"
        >
          <span class="options-switch__knob" />
        </button>
      </div>

      <button type="button" class="options-btn options-btn--primary options-btn--full" @click="updateUserInfoFunc">
        <Icon icon="tabler:device-floppy" width="18" height="18" aria-hidden="true" />
        保存资料
      </button>
    </section>

    <!-- 密码 -->
    <section class="options-sheet" aria-label="重置密码">
      <p class="options-overline">
        安全
      </p>
      <label class="options-field">
        <span class="options-field__label">邮箱验证码</span>
        <input ref="VCode" type="text" class="options-input" inputmode="numeric" autocomplete="one-time-code" placeholder="发送到绑定邮箱">
      </label>
      <button type="button" class="options-btn options-btn--secondary options-btn--full" @click="codeHandler">
        <Icon icon="tabler:mail-forward" width="18" height="18" aria-hidden="true" />
        发送验证码
      </button>
      <label class="options-field">
        <span class="options-field__label">新密码</span>
        <input ref="password1" type="password" class="options-input" autocomplete="new-password" placeholder="至少 6 位">
      </label>
      <label class="options-field">
        <span class="options-field__label">确认新密码</span>
        <input ref="password2" type="password" class="options-input" autocomplete="new-password" placeholder="再次输入">
      </label>
      <button type="button" class="options-btn options-btn--primary options-btn--full" @click="updatePasswordFunc">
        <Icon icon="tabler:key" width="18" height="18" aria-hidden="true" />
        重置密码
      </button>
    </section>

    <!-- 偏好 -->
    <section class="options-sheet options-sheet--compact" aria-label="通知与显示">
      <div class="options-row-toggle">
        <span class="options-row-toggle__title">邮件推送</span>
        <button
          type="button"
          class="options-switch"
          :class="{ 'options-switch--on': isPushDisabled }"
          role="switch"
          :aria-checked="isPushDisabled"
          @click="togglePush"
        >
          <span class="options-switch__knob" />
        </button>
      </div>
      <div v-if="isPC" class="options-row-toggle options-row-toggle--bordered">
        <span class="options-row-toggle__title">电脑端样式新体验</span>
        <button
          type="button"
          class="options-switch"
          :class="{ 'options-switch--on': pwaExperienceEnabled }"
          role="switch"
          :aria-checked="pwaExperienceEnabled"
          @click="togglePWAExperience"
        >
          <span class="options-switch__knob" />
        </button>
      </div>
    </section>

    <button type="button" class="options-btn options-btn--danger options-btn--full" @click="logout">
      <Icon icon="tabler:logout" width="18" height="18" aria-hidden="true" />
      退出登录
    </button>
  </div>
</template>

<style scoped lang="scss">
.options-page {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 14px 2rem;
  box-sizing: border-box;
  min-height: 100%;
  color: var(--chat-text);
  background: linear-gradient(
    180deg,
    var(--chat-accent-soft) 0%,
    var(--chat-bg-main) 120px,
    var(--chat-bg-main) 100%
  );
}

.options-page__head {
  margin-bottom: 1rem;
}

.options-page__title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.options-page__title-icon {
  color: var(--chat-accent);
  flex-shrink: 0;
}

.options-page__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--chat-text);
}

.options-page__subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.875rem;
  color: var(--chat-text-secondary);
}

.options-sheet {
  background: var(--chat-bg-highlight);
  border: 1px solid var(--chat-border);
  border-radius: 20px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  padding: 18px;
  margin-bottom: 12px;
}

.options-sheet--compact {
  padding: 6px 4px;
}

.options-overline {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--chat-text-tips);
}

.options-identity {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.options-identity__avatar-wrap {
  flex-shrink: 0;
  padding: 3px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--chat-accent-soft), transparent);
}

.options-identity__avatar {
  display: block;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--chat-bg-main);
  border: 2px solid var(--chat-bg-highlight);
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.08);
}

.options-identity__main {
  min-width: 0;
  flex: 1;
}

.options-identity__name {
  margin: 0 0 8px;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--chat-text);
  word-break: break-word;
}

.options-kv {
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 4px;

  &--inline {
    display: flex;
    gap: 8px;
    align-items: baseline;
  }
}

.options-kv__k {
  color: var(--chat-text-tips);
  flex-shrink: 0;
}

.options-kv__v {
  color: var(--chat-text-secondary);
  word-break: break-all;

  &--truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
}

.options-btn--file {
  position: relative;
  overflow: hidden;
}

.options-file-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  font-size: 0;
}

.options-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 18px;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    filter 0.15s ease,
    transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;

  &--full {
    width: 100%;
    box-sizing: border-box;
  }

  &--primary {
    background: var(--chat-accent);
    border-color: var(--chat-accent);
    color: #fff;

    &:hover {
      filter: brightness(1.05);
    }

    &:active {
      transform: scale(0.99);
    }
  }

  &--secondary {
    background: var(--chat-bg-main);
    border-color: var(--chat-border-strong);
    color: var(--chat-accent);

    &:hover {
      background: var(--chat-accent-soft);
      border-color: var(--chat-accent);
    }
  }

  &--danger {
    margin-top: 4px;
    background: var(--chat-bg-highlight);
    border-color: rgba(239, 68, 68, 0.35);
    color: #ef4444;

    &:hover {
      background: rgba(239, 68, 68, 0.06);
      border-color: rgba(239, 68, 68, 0.55);
    }
  }
}

.options-divider {
  height: 1px;
  margin: 16px 0;
  background: var(--chat-border);
}

.options-exp-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin-bottom: 10px;
}

.options-level-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;

  &--muted {
    background: var(--chat-bg-main);
    border: 1px dashed var(--chat-border);
    color: var(--chat-text-tips);
    font-weight: 500;
  }
}

.options-exp-num {
  margin-left: auto;
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--chat-text-secondary);
}

.options-progress-track {
  height: 8px;
  border-radius: 999px;
  background: var(--chat-bg-main);
  overflow: hidden;
  border: 1px solid var(--chat-border);
}

.options-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--chat-accent-soft), var(--chat-accent));
  transition: width 0.35s ease;
}

.options-field {
  display: block;
  margin-bottom: 14px;
}

.options-field__label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--chat-text-secondary);
}

.options-input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  font-size: 15px;
  font-family: inherit;
  color: var(--chat-text);
  background: var(--chat-bg-main);
  border: 1px solid var(--chat-border);
  border-radius: 12px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &::placeholder {
    color: var(--chat-text-tips);
  }

  &:focus {
    border-color: var(--chat-accent);
    box-shadow: 0 0 0 3px var(--chat-accent-soft);
  }
}

.options-row-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  margin: 0 -4px;
  border-radius: 14px;

  &--bordered {
    border-top: 1px solid var(--chat-border);
    margin-top: 4px;
    padding-top: 14px;
  }
}

.options-row-toggle__text {
  min-width: 0;
  flex: 1;
}

.options-row-toggle__title {
  display: block;
  font-size: 15px;
  font-weight: 500;
  color: var(--chat-text);
  line-height: 1.35;
}

.options-row-toggle__hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--chat-text-tips);
}

.options-switch {
  position: relative;
  flex-shrink: 0;
  width: 50px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 15px;
  background: var(--chat-bg-main);
  box-shadow: inset 0 0 0 1px var(--chat-border-strong);
  cursor: pointer;
  transition: background 0.2s ease, box-shadow 0.2s ease;
  -webkit-tap-highlight-color: transparent;

  &--on {
    background: var(--chat-accent);
    box-shadow: inset 0 0 0 1px transparent;
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}

.options-switch__knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--chat-bg-highlight);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
  transition: transform 0.2s ease;
}

.options-switch--on .options-switch__knob {
  transform: translateX(20px);
}

/* 等级徽章配色（与历史设置页一致） */
.options-level-badge.level-undefined {
  text-shadow:
    0.12em 0.12em var(--color-level-undefined-box-shadow),
    -0.12em -0.12em var(--color-level-undefined-box-shadow);
}

.options-level-badge.level-0 {
  background-color: #36c7d9;
  color: #fff;
}

.options-level-badge.level-1 {
  background-color: #66d934;
  color: #fff;
}

.options-level-badge.level-2 {
  background-color: #d74a4a;
  color: #fff;
}

.options-level-badge.level-3 {
  background-color: rgb(240, 133, 39);
  color: #fff;
}

.options-level-badge.level-4 {
  background: linear-gradient(45deg, #ff7d7d, #ff5a99, #e376e5, #9a7ef8);
  background-size: 300% 300%;
  color: #fff;
  animation: options-change-color 5s ease infinite;
}

.options-level-badge.level-5 {
  background: linear-gradient(45deg, #ff7d7d, #ff5a99, #e376e5, #9a7ef8);
  background-size: 300% 300%;
  color: transparent;
  background-clip: text;
  -webkit-background-clip: text;
  animation: options-change-color 5s ease infinite;
}

.options-level-badge.level-6 {
  position: relative;
  background: linear-gradient(45deg, #ff7d7d, #ff5a99, #e376e5, #9a7ef8);
  background-size: 300% 300%;
  color: transparent;
  background-clip: text;
  -webkit-background-clip: text;
  animation: options-change-color 5s ease infinite;
}

.options-level-badge.level-6::before {
  content: 'Lv6 专家';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotateX(180deg);
  transform-origin: bottom;
  line-height: 1.2;
  background: linear-gradient(0deg, #9a7ef8 0, transparent 80%);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  opacity: 0.5;
  font-size: inherit;
  font-weight: inherit;
}

.options-level-badge.level-7 {
  position: relative;
  line-height: 1.2;
  background: linear-gradient(45deg, #ff7d7d, #ff5a99, #e376e5, #9a7ef8);
  color: transparent;
  background-clip: text;
  -webkit-background-clip: text;
  animation: options-change-color 5s ease infinite;
  background-size: 300% 300%;
}

.options-level-badge.level-7::before {
  content: 'Lv7 大神';
  transform: rotateX(180deg);
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: bottom;
  background: linear-gradient(
    45deg,
    #ff7d7d3e,
    #ff5a993e,
    #e376e53e,
    #9a7ef83e,
    transparent,
    #9a7ef73e,
    #e376e53e,
    #ff5a993e,
    #ff7d7d3e
  );
  background-size: 300% 300%;
  color: transparent;
  background-clip: text;
  -webkit-background-clip: text;
  animation: options-change-color 5s ease infinite;
  opacity: 0.5;
  font-size: inherit;
  font-weight: inherit;
}

.options-level-badge.level-8 {
  position: relative;
  line-height: 1.2;
  text-shadow:
    2px 2px 4px rgba(0, 0, 0, 0.3),
    -2px -2px 4px rgba(255, 255, 255, 0.3);
}

.options-level-badge.level-8::before {
  content: '祖师爷';
  transform: rotateX(160deg) skew(10deg);
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: bottom;
  background: linear-gradient(
    45deg,
    #ff7d7d,
    #ff5a99,
    #e376e5,
    #9a7ef8,
    transparent,
    #9a7ef8,
    #e376e5,
    #ff5a99,
    #ff7d7d
  );
  background-size: 300% 300%;
  color: transparent;
  background-clip: text;
  -webkit-background-clip: text;
  animation: options-change-color 5s ease infinite;
  opacity: 0.25;
  font-size: inherit;
  font-weight: inherit;
}

@keyframes options-change-color {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@media screen and (max-width: 480px) {
  .options-exp-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .options-exp-num {
    margin-left: 0;
  }
}
</style>
