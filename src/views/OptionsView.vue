<script setup lang="ts">
import type { Ref } from 'vue'
import type { AllInfo } from '@/api/info/getInfo'
import { computed, inject, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getSelfAllInfo, isEmailNotificationBlocked, normalizeAllInfo } from '@/api/info/getInfo'
import { updateEmailPush, updateUserInfo, uploadAvatar } from '@/api/info/updateInfo'
import { changeEmail } from '@/api/LoginAndRegister/changeEmail'
import { updatePassword } from '@/api/LoginAndRegister/forgetPwd'
import { sendCode } from '@/api/LoginAndRegister/utils'
import { ssoBindStart, ssoStatus, ssoUnbind } from '@/api/sso/sso'
import ApiTokenPanel from '@/components/ApiTokenPanel.vue'
import { showMsg } from '@/components/MessageBox'
import { SettingsExpander, SettingsGroup, SettingsHero, SettingsInput, SettingsToggle } from '@/components/settings'
import { usePWA } from '@/composables/usePWA'
import { useUserStore } from '@/store/userStore'
import { levelClassHandler, levelExpHandler, levelNameHandler } from '@/utils/level'
import { defaultAvatarFor } from '@/utils/defaultAvatar'

const router = useRouter()
const isPC = inject('isPC', ref(false)) as Ref<boolean>
const { userInfo, setToken, setRefreshToken, setUserInfo } = useUserStore()
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

const defaultAvatar = defaultAvatarFor(userInfo.userID)
const settingsAvatarSrc = ref(defaultAvatar)

const isPushDisabled = ref(false)
const hidePostsSyncing = ref(false)

// 各 expander 独立 open 状态(可同时展开,不强制手风琴)
const userNameOpen = ref(false)
const userIntroOpen = ref(false)
const passwordOpen = ref(false)
const patOpen = ref(false)
const ssoOpen = ref(false)
const emailOpen = ref(false)

// SSO 绑定状态
const ssoBound = ref(false)
const ssoBoundUsername = ref('')
const ssoBoundAt = ref('')
const ssoUnbindPassword = ref('')
const ssoBusy = ref(false)

// 表单本地草稿(展开时初始化,保存时写回 allInfo)
const passwordForm = ref({ vcode: '', password1: '', password2: '' })
const emailForm = ref({ newEmail: '', vcode: '' })
let changingEmail = false
const userNameDraft = ref('')
const userIntroDraft = ref('')

const accountGroupRef = useTemplateRef<HTMLElement>('accountGroup')

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

/** 从服务端拉取设置并同步开关状态(避免本地状态与 DB 不一致) */
async function reloadSettingsFromServer() {
  const info = normalizeAllInfo(await getSelfAllInfo(userInfo.userID))
  allInfo.value = info
  isPushDisabled.value = isEmailNotificationBlocked(
    info.emailNotificationBlocked ?? info.emailpush,
  )
}

/** 将当前 allInfo 同步到服务器(头像 / 隐藏发帖开关会即时调用) */
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

async function onUploadAvatar(e: Event) {
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

function onAvatarError() {
  if (settingsAvatarSrc.value !== defaultAvatar)
    settingsAvatarSrc.value = defaultAvatar
}

function onEditProfile() {
  // 滚动到「账号资料」分组并展开「用户名」表单
  userNameOpen.value = true
  userNameDraft.value = allInfo.value?.name ?? ''
  nextTick(() => {
    accountGroupRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function onUserNameOpenChange(open: boolean) {
  if (open)
    userNameDraft.value = allInfo.value?.name ?? ''
}

async function saveUserName() {
  if (!allInfo.value)
    return
  allInfo.value.name = userNameDraft.value
  try {
    await persistUserInfoToServer()
    userNameOpen.value = false
  }
  catch {
    // 错误已在 persist 内提示
  }
}

function onUserIntroOpenChange(open: boolean) {
  if (open)
    userIntroDraft.value = allInfo.value?.intro ?? ''
}

async function saveUserIntro() {
  if (!allInfo.value)
    return
  allInfo.value.intro = userIntroDraft.value
  try {
    await persistUserInfoToServer()
    userIntroOpen.value = false
  }
  catch {
    // 错误已在 persist 内提示
  }
}

async function toggleHideProfile(value: boolean) {
  if (!allInfo.value || hidePostsSyncing.value)
    return
  const prev = !!allInfo.value.hideProfilePosts
  allInfo.value.hideProfilePosts = value
  hidePostsSyncing.value = true
  try {
    await persistUserInfoToServer()
    await reloadSettingsFromServer()
  }
  catch {
    allInfo.value.hideProfilePosts = prev
    await reloadSettingsFromServer()
    showMsg('同步失败，已恢复原设置')
  }
  finally {
    hidePostsSyncing.value = false
  }
}

async function togglePush() {
  try {
    if (!allInfo.value)
      return
    await updateEmailPush(allInfo.value.userID)
    await reloadSettingsFromServer()
    showMsg(
      isPushDisabled.value
        ? '已禁用邮箱推送，将不再接收系统邮件'
        : '已允许邮箱推送，将恢复接收系统邮件',
    )
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

async function sendPasswordCode() {
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

async function resetPassword() {
  if (passwordForm.value.password1 === '' || passwordForm.value.password2 === '') {
    showMsg('密码不能为空')
    return
  }
  if (passwordForm.value.password1 !== passwordForm.value.password2) {
    showMsg('两次密码不一致')
    return
  }
  try {
    const res = await updatePassword(
      allInfo.value.email,
      passwordForm.value.password1,
      passwordForm.value.password2,
      passwordForm.value.vcode,
    )
    showMsg(res.msg)
    passwordForm.value = { vcode: '', password1: '', password2: '' }
    passwordOpen.value = false
  }
  catch (e) {
    showMsg('更新密码失败')
    console.error(e)
  }
}

function validateNewEmail(email: string): boolean {
  const trimmed = email.trim()
  if (trimmed === '') {
    showMsg('请输入新邮箱')
    return false
  }
  if (trimmed.length > 255) {
    showMsg('邮箱长度不能超过255个字符')
    return false
  }
  const at = trimmed.indexOf('@')
  if (at <= 0 || at !== trimmed.lastIndexOf('@') || at === trimmed.length - 1) {
    showMsg('邮箱格式不正确')
    return false
  }
  return true
}

async function sendEmailCode() {
  try {
    if (!validateNewEmail(emailForm.value.newEmail))
      return
    const email = emailForm.value.newEmail.trim()
    const data = await sendCode(email, 0)
    if (!data)
      return
    showMsg('验证码发过去啦')
  }
  catch (e) {
    showMsg('发送验证码失败')
    console.error(e)
  }
}

async function resetEmail() {
  if (changingEmail)
    return
  if (!validateNewEmail(emailForm.value.newEmail))
    return
  if (emailForm.value.vcode === '') {
    showMsg('请输入验证码')
    return
  }
  const email = emailForm.value.newEmail.trim()
  if (email.toLowerCase() === userInfo.email.trim().toLowerCase()) {
    showMsg('新邮箱不能与当前邮箱相同')
    return
  }
  changingEmail = true
  try {
    const res = await changeEmail(email, emailForm.value.vcode)
    if (!res)
      return
    showMsg(`${res.msg || '邮箱修改成功'}，请重新登录`)
    setToken('')
    setRefreshToken('')
    setUserInfo({
      userID: 0,
      name: '',
      avatarURL: '',
      phone: '',
      email: '',
      identity: '',
      coins: 0,
    })
    emailForm.value = { newEmail: '', vcode: '' }
    emailOpen.value = false
    router.push('/auth/login')
  }
  catch (e) {
    showMsg('更新邮箱失败')
    console.error(e)
  }
  finally {
    changingEmail = false
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

async function loadSsoStatus() {
  const status = await ssoStatus()
  if (!status) {
    ssoBound.value = false
    ssoBoundUsername.value = ''
    ssoBoundAt.value = ''
    return
  }
  ssoBound.value = !!status.bound
  ssoBoundUsername.value = status.sso_username ?? ''
  ssoBoundAt.value = status.bound_at ?? ''
}

async function startSsoBind() {
  if (ssoBusy.value)
    return
  ssoBusy.value = true
  try {
    const url = await ssoBindStart()
    if (!url) {
      showMsg('SSO 服务暂不可用')
      return
    }
    window.location.href = url
  }
  finally {
    ssoBusy.value = false
  }
}

async function confirmUnbindSso() {
  if (ssoBusy.value)
    return
  const password = ssoUnbindPassword.value.trim()
  if (!password) {
    showMsg('请输入登录密码以确认解绑')
    return
  }
  ssoBusy.value = true
  try {
    const ok = await ssoUnbind(password)
    if (!ok) {
      showMsg('密码错误或解绑失败')
      return
    }
    ssoUnbindPassword.value = ''
    await loadSsoStatus()
    showMsg('已解绑 SSO')
  }
  finally {
    ssoBusy.value = false
  }
}

onMounted(() => {
  void reloadSettingsFromServer()
  void loadSsoStatus()
})
</script>

<template>
  <div class="options-page">
    <SettingsHero
      :avatar-src="settingsAvatarSrc"
      :name="allInfo.name"
      :uid="allInfo.userID"
      :phone="allInfo.phone"
      :level-label="levelNameHandler(allInfo.score || 0)"
      :level-class="levelClassHandler(allInfo.score || 0)"
      :exp-percent="expPercent"
      :score="allInfo.score ?? 0"
      :exp-target="expTarget"
      :next-level-label="nextLevelLabel"
      :coins="allInfo.coins"
      @upload-avatar="onUploadAvatar"
      @avatar-error="onAvatarError"
      @edit-profile="onEditProfile"
    />

    <!-- 分组 1: 账号资料 -->
    <SettingsGroup title="账号资料">
      <div ref="accountGroup" class="options-anchor" />
      <SettingsExpander
        v-model:open="userNameOpen"
        label="用户名"
        :value="allInfo.name"
        @update:open="onUserNameOpenChange"
      >
        <SettingsInput
          v-model="userNameDraft"
          label="用户名"
          placeholder="展示名称"
          autocomplete="nickname"
        />
        <button type="button" class="options-form-btn options-form-btn--primary" @click="saveUserName">
          保存
        </button>
      </SettingsExpander>

      <SettingsExpander
        v-model:open="userIntroOpen"
        label="个人简介"
        :value="allInfo.intro"
        @update:open="onUserIntroOpenChange"
      >
        <SettingsInput
          v-model="userIntroDraft"
          label="个人简介"
          placeholder="一句话介绍自己"
          autocomplete="off"
        />
        <button type="button" class="options-form-btn options-form-btn--primary" @click="saveUserIntro">
          保存
        </button>
      </SettingsExpander>

      <SettingsToggle
        :model-value="!!allInfo.hideProfilePosts"
        :disabled="hidePostsSyncing"
        title="在个人主页隐藏发帖"
        hint="开启后仅本人可见历史发帖"
        @update:model-value="toggleHideProfile"
      />
    </SettingsGroup>

    <!-- 分组 2: 安全 -->
    <SettingsGroup title="安全">
      <SettingsExpander v-model:open="passwordOpen" label="修改密码">
        <SettingsInput
          v-model="passwordForm.vcode"
          label="邮箱验证码"
          placeholder="发送到绑定邮箱"
          inputmode="numeric"
          autocomplete="one-time-code"
        />
        <button type="button" class="options-form-btn options-form-btn--secondary" @click="sendPasswordCode">
          发送验证码
        </button>
        <SettingsInput
          v-model="passwordForm.password1"
          label="新密码"
          type="password"
          placeholder="至少 6 位"
          autocomplete="new-password"
        />
        <SettingsInput
          v-model="passwordForm.password2"
          label="确认新密码"
          type="password"
          placeholder="再次输入"
          autocomplete="new-password"
        />
        <button type="button" class="options-form-btn options-form-btn--primary" @click="resetPassword">
          重置密码
        </button>
      </SettingsExpander>

      <SettingsExpander v-model:open="emailOpen" label="修改邮箱">
        <SettingsInput
          v-model="emailForm.newEmail"
          label="新邮箱"
          type="email"
          placeholder="新邮箱地址"
          autocomplete="email"
        />
        <button type="button" class="options-form-btn options-form-btn--secondary" @click="sendEmailCode">
          发送验证码
        </button>
        <SettingsInput
          v-model="emailForm.vcode"
          label="邮箱验证码"
          placeholder="发送到新邮箱"
          inputmode="numeric"
          autocomplete="one-time-code"
        />
        <button type="button" class="options-form-btn options-form-btn--primary" @click="resetEmail">
          修改邮箱
        </button>
      </SettingsExpander>
    </SettingsGroup>

    <!-- 分组 3: SSO 账号绑定 -->
    <SettingsGroup title="SSO 账号绑定">
      <SettingsExpander v-model:open="ssoOpen" label="UniSSO 绑定" :hint="ssoBound ? '已绑定' : '未绑定'">
        <template v-if="ssoBound">
          <p class="options-hint">
            当前绑定 SSO：{{ ssoBoundUsername || '未知' }}
            <span v-if="ssoBoundAt" class="options-hint__meta">
              绑定于 {{ ssoBoundAt }}
            </span>
          </p>
          <SettingsInput
            v-model="ssoUnbindPassword"
            label="登录密码"
            type="password"
            placeholder="输入登录密码以确认解绑"
            autocomplete="current-password"
          />
          <button
            type="button"
            class="options-form-btn options-form-btn--primary"
            :disabled="ssoBusy"
            @click="confirmUnbindSso"
          >
            解绑 SSO
          </button>
        </template>
        <template v-else>
          <p class="options-hint">
            绑定后可使用 UniSSO 账号直接登录集市。点击下方按钮将跳转至 UniSSO 完成授权。
          </p>
          <button
            type="button"
            class="options-form-btn options-form-btn--primary"
            :disabled="ssoBusy"
            @click="startSsoBind"
          >
            绑定 UniSSO
          </button>
        </template>
      </SettingsExpander>
    </SettingsGroup>

    <!-- 分组 4: 通用 -->
    <SettingsGroup title="通用">
      <SettingsToggle
        :model-value="isPushDisabled"
        title="禁用邮箱推送"
        hint="开启后将不再接收系统邮件"
        @update:model-value="togglePush"
      />
      <SettingsToggle
        v-if="isPC"
        :model-value="pwaExperienceEnabled"
        title="电脑端样式新体验"
        hint="实验性 PWA 布局"
        @update:model-value="togglePWAExperience"
      />
    </SettingsGroup>

    <!-- 分组 5: 开发者(默认折叠) -->
    <SettingsGroup title="开发者">
      <SettingsExpander v-model:open="patOpen" label="个人访问令牌(PAT)" hint="用于 MCP 等对外调用">
        <ApiTokenPanel v-if="patOpen" />
      </SettingsExpander>
    </SettingsGroup>

    <button type="button" class="options-logout" @click="logout">
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
  color: var(--color-text);
  background: var(--color-bg);
}

.options-anchor {
  position: relative;
  top: -100px;
  visibility: hidden;
}

.options-form-btn {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
  -webkit-tap-highlight-color: transparent;

  &--primary {
    background: var(--accent);
    color: #fff;

    &:hover {
      background: var(--accent-hover);
    }
  }

  &--secondary {
    background: var(--color-card);
    border-color: var(--color-border-strong);
    color: var(--accent);

    &:hover {
      background: var(--color-hover);
    }
  }
}

.options-logout {
  margin-top: 24px;
  width: 100%;
  padding: 12px;
  background: var(--color-card);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-lg);
  color: #ef4444;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  box-shadow: var(--color-card-shadow);
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.06);
    border-color: rgba(239, 68, 68, 0.55);
  }
}

.options-hint {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.options-hint__meta {
  display: inline-block;
  margin-left: 8px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}
</style>
