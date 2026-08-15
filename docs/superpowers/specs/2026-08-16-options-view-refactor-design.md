# OptionsView 重构设计

- 日期: 2026-08-16
- 范围: `src/views/OptionsView.vue` 及其新增子组件
- 路由: `/options`
- 参考: `src/views/UserProfileView.vue`(藏青 banner + 浮起头像卡片)、`src/views/WorkbenchView.vue`(分组卡片)
- 目标: 信息架构重组 + 视觉 token 对齐,达到企业微信/iOS 设置页水准,与现有主页视觉风格一致

## 1. 现状梳理

### 1.1 当前信息架构(6 个并列卡片)

1. 账号概览 — 头像、昵称、手机、邮箱、换头像按钮、等级+经验条
2. 编辑资料 — 用户名、简介、"隐藏主页发帖"开关、保存按钮
3. 重置密码 — 邮箱验证码、新密码、确认密码
4. 偏好 — 邮箱推送开关、PC 端 PWA 体验开关
5. 开发者 — `ApiTokenPanel`(PAT 创建/列表/吊销/删除 + 帮助弹层)
6. 退出登录按钮

### 1.2 接口调用(保持不变)

| 接口 | 路径 | 触发时机 |
|------|------|---------|
| `getAllInfo(phone)` | POST `/auth/getInfo` | 页面挂载 |
| `updateUserInfo(avatar, intro, name, userID, hideProfilePosts)` | POST `/auth/updateUserInfo` | 头像上传后 / 保存资料 / 隐藏发帖切换 |
| `uploadAvatar(file)` | POST `/auth/uploadAvatar`(FormData) | 选择头像文件 |
| `updateEmailPush(userID)` | POST `/auth/changeEmailPush` | 切换邮箱推送 |
| `sendCode(email, 1)` + `updatePassword(email, pwd1, pwd2, vcode)` | LoginAndRegister 模块 | 重置密码 |
| `listAPITokenScopes()` / `listAPITokens(1, 50)` / `createAPIToken` / `revokeAPIToken` / `deleteAPIToken` | PAT 模块 | PAT 面板展开后 |

### 1.3 已识别问题

1. **色彩 token 滞后** — 使用 `--chat-*` 老变量,与全站 `--color-*` / `--accent` 藏青冷灰体系不一致
2. **圆角规范不匹配** — 卡片用 20px,全站规范为 `--radius-lg: 8px`
3. **信息层级失衡** — 账号概览与编辑资料被切成两卡但同属"个人资料";密码重置与日常设置平权;PAT 与普通设置视觉权重相近
4. **未遵循分组列表范式** — `UserProfileView` 已采用 iOS 分组列表,`OptionsView` 应保持一致
5. **banner 头部缺失** — `UserProfileView` / `WorkbenchView` 都有藏青色顶部色块作为视觉锚点,`OptionsView` 没有
6. **`ApiTokenPanel` 自成一套样式** — 应统一到同一套卡片/按钮/输入框 token 体系

## 2. 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 重构范围 | 信息架构重组 + 视觉重涂 | 保留全部功能,仅重组分组与替换 token |
| 页面骨架 | 顶部藏青 banner + 浮起头像卡片 + iOS 分组列表 | 与 `UserProfileView` / `WorkbenchView` 视觉锚点一致 |
| 编辑交互 | 原地内联展开(无跳转) | 减少跳转,符合 iOS 设置范式 |
| PAT 面板 | 折叠式卡片(默认收起) | 普通用户与开发者内容分层,PAT 展开时才懒加载 |

## 3. 新信息架构

```
📄 设置页 /options
├── 🟦 Hero 头像卡片(浮起在 banner 上)
│   ├── 头像(点击换)
│   ├── 昵称
│   ├── UID + 手机摘要
│   ├── 等级徽章 + 经验进度条
│   └── [编辑资料] 按钮(快捷入口:滚动到「账号资料」分组并展开「用户名」表单)
├── 📋 分组 1 · 账号资料
│   ├── 用户名(点击展开输入框 + 保存)
│   ├── 个人简介(点击展开输入框 + 保存)
│   └── 在个人主页隐藏发帖(开关,即时同步)
├── 🔒 分组 2 · 安全
│   └── 修改密码(点击展开: 邮箱验证码 / 发送验证码 / 新密码 / 确认密码 / 重置)
├── ⚙️ 分组 3 · 通用
│   ├── 禁用邮箱推送(开关)
│   └── 电脑端样式新体验(开关,仅 PC 显示)
├── 🔑 分组 4 · 开发者(默认折叠)
│   └── 个人访问令牌(PAT)(点击展开 ApiTokenPanel 全部内容)
└── 🚪 退出登录(独立危险按钮,与分组分离)
```

## 4. 页面布局规范

- 容器:`max-width: 720px; margin: 0 auto; padding: 0 14px 2rem`
- 顶部 banner: `linear-gradient(135deg, var(--accent) 0%, #1e293b 100%); height: 88px`(深色模式用深色变体)
- Hero 卡片: `margin-top: -36px` 浮在 banner 上,`background: var(--color-card); border-radius: var(--radius-lg); padding: 16px; box-shadow: var(--color-card-shadow)`
- 分组标题: `font-size: 12px; font-weight: 500; color: var(--color-text-muted); margin: 18px 0 6px 4px; letter-spacing: 0.04em`
- 分组卡片: `background: var(--color-card); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--color-card-shadow)`
- 分组内行: `padding: 13px 16px; border-bottom: 1px solid var(--color-border)`(最后一行无下边框)
- 行字号: 标题 14px / `var(--color-text)`;值 14px / `var(--color-text-secondary)`;箭头 `var(--color-text-muted)`
- 箭头: `›` 字符,展开时旋转 90°
- 开关: 36×22px,圆角 11px,开启 `var(--accent)` / 关闭 `var(--color-button-bg-secondary)`(#f1f5f9 浅色,#334155 深色),knob 18×18px
- 输入框: `padding: 10px 12px; font-size: 14px; background: var(--color-card); border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); :focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }`
- 展开表单容器: `padding: 14px 16px; background: var(--color-hover)`(浅色 rgba(44,61,86,0.04);深色 rgba(148,163,184,0.08))
- 退出登录按钮: `margin-top: 24px; width: 100%; background: var(--color-card); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; font-size: 14px; font-weight: 500; border-radius: var(--radius-lg); box-shadow: var(--color-card-shadow)`

## 5. 组件层级

```
OptionsView.vue (页面容器 + 状态编排 + onMounted 拉取数据)
├── SettingsHero.vue        banner + 头像 + 摘要 + 经验条 + 编辑按钮
├── SettingsGroup.vue       分组容器(标题 + 卡片 + 阴影)
├── SettingsRow.vue         通用行(label + value + 箭头)
├── SettingsToggle.vue      开关行(label + hint + switch)
├── SettingsExpander.vue    可展开行(包裹表单内容,支持 v-model:open)
├── SettingsInput.vue       带 label 的输入框
└── ApiTokenPanel.vue       (已存在,仅替换内部 token)
```

### 5.1 组件接口

#### `SettingsHero.vue`
```vue
<script setup lang="ts">
defineProps<{
  avatarSrc: string
  name: string
  uid: number
  phone: string
  levelLabel: string
  levelClass: string
  score: number
  expTarget: number
  expPercent: number
  nextLevelLabel: string
}>()
defineEmits<{
  'upload-avatar': [event: Event]
  'edit-profile': []
}>()
</script>
```

#### `SettingsGroup.vue`
```vue
<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>
<template>
  <section class="settings-group">
    <p class="settings-group__title">{{ title }}</p>
    <div class="settings-group__card">
      <slot />
    </div>
  </section>
</template>
```

#### `SettingsRow.vue`
```vue
<script setup lang="ts">
defineProps<{
  label: string
  value?: string
  clickable?: boolean
}>()
defineEmits<{
  click: []
}>()
</script>
```

#### `SettingsToggle.vue`
```vue
<script setup lang="ts">
defineProps<{
  title: string
  hint?: string
  modelValue: boolean
  disabled?: boolean
}>()
defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>
```

#### `SettingsExpander.vue`
```vue
<script setup lang="ts">
defineProps<{
  label: string
  value?: string
  open: boolean
}>()
defineEmits<{
  'update:open': [value: boolean]
}>()
</script>
<template>
  <div class="settings-expander">
    <SettingsRow :label="label" :value="value" clickable @click="$emit('update:open', !open)" />
    <!-- 用 v-if 而非 v-show:确保 PAT 等面板懒加载、收起时卸载 -->
    <div v-if="open" class="settings-expander__body">
      <slot />
    </div>
  </div>
</template>
```

**关于 v-if vs v-show 的选择:**
统一用 `v-if`,理由:
- PAT 面板需要懒加载(展开时才发请求)和卸载(收起后释放内存)
- 修改密码表单每次展开天然为空,无需保留状态
- 用户名/简介展开时从 `allInfo` 重新读取,无状态丢失问题

#### `SettingsInput.vue`
```vue
<script setup lang="ts">
defineProps<{
  label: string
  modelValue: string
  type?: string
  placeholder?: string
  autocomplete?: string
  inputmode?: string
}>()
defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
```

## 6. 交互流

**Expander 状态管理:** 每个 `SettingsExpander` 独立维护 `open` 状态(分别用 `userNameOpen` / `userIntroOpen` / `passwordOpen` / `patOpen` 等 ref)。多个 expander 可同时展开,互不影响(不强制手风琴模式)。点击已展开的 expander 标题行收起。

### 6.1 页面挂载
```
onMounted → reloadSettingsFromServer()
  → getAllInfo(userInfo.phone)
  → normalizeAllInfo(...)
  → 填充 allInfo / isPushDisabled
```

### 6.2 头像上传
```
点击 Hero 头像区 → <input type="file" change>
  → uploadAvatar(file)            // 拿到 avatarURL
  → allInfo.avatarURL = res.data.avatar_url
  → persistUserInfoToServer()      // updateUserInfo(...)
  失败 → toast「头像已上传,但资料未同步」
  成功 → 头像 src 即时更新
```

### 6.3 编辑用户名 / 简介(原地展开)
```
点击「用户名」行 → userNameOpen = true
  → 输入框 v-model 绑定 allInfo.name
点击行内「保存」
  → persistUserInfoToServer()
  成功 → toast(res.msg) + userNameOpen = false
  失败 → toast 错误信息,保持展开

点击「个人简介」行 → userIntroOpen = true
  → 输入框 v-model 绑定 allInfo.intro
点击行内「保存」
  → persistUserInfoToServer()
  成功 → toast(res.msg) + userIntroOpen = false
  失败 → toast 错误信息,保持展开

点击 Hero [编辑资料] 按钮
  → scrollIntoView({ behavior: 'smooth', block: 'start' }) 到「账号资料」分组
  → userNameOpen = true
```

### 6.4 切换"隐藏主页发帖"
```
开关点击(乐观更新)
  → hidePostsSyncing = true
  → allInfo.hideProfilePosts = !prev
  → persistUserInfoToServer()
  → reloadSettingsFromServer()
  失败 → 回滚 + toast「同步失败,已恢复原设置」
  finally → hidePostsSyncing = false
```

### 6.5 切换"禁用邮箱推送"
```
开关点击
  → updateEmailPush(allInfo.userID)
  → reloadSettingsFromServer()
  → toast(已禁用 / 已允许)
```

### 6.6 修改密码(原地展开)
```
点击「修改密码」行 → passwordOpen = true
点击「发送验证码」
  → sendCode(allInfo.email, 1)
  → toast「验证码发过去啦」
点击「重置密码」
  → 校验非空 + 两次一致
  → updatePassword(email, pwd1, pwd2, vcode)
  → toast(res.msg)
  成功 → 清空表单 + passwordOpen = false
```

### 6.7 PAT 面板(折叠展开)
```
点击「个人访问令牌」行 → patOpen = true
  → SettingsExpander 的 v-if 渲染 ApiTokenPanel
  → ApiTokenPanel onMounted 钩子触发
  → listAPITokenScopes() + listAPITokens(1, 50)
点击「个人访问令牌」行再次 → patOpen = false
  → v-if 卸载 ApiTokenPanel(释放内存)
```

### 6.8 退出登录
```
点击退出登录按钮
  → confirm('确定要退出登录吗')
  → localStorage 清理(userInfo / token / email / password / rememberMe)
  → setToken('') / setRefreshToken('')
  → router.push('/')
  → window.location.reload()
```

## 7. 设计 token 对齐

移除所有 `--chat-*` 变量,统一到全站 `--color-*` / `--accent` 体系:

| 旧(待删除) | 新(统一) |
|------------|-----------|
| `--chat-bg-main` | `--color-bg` |
| `--chat-bg-highlight` | `--color-card` |
| `--chat-border` | `--color-border` |
| `--chat-border-strong` | `--color-border-strong` |
| `--chat-text` | `--color-text` |
| `--chat-text-secondary` | `--color-text-secondary` |
| `--chat-text-tips` | `--color-text-muted` |
| `--chat-accent` | `--accent` |
| `--chat-accent-soft` | `--accent-soft` |
| 卡片 border-radius: 20px | `var(--radius-lg)` = 8px |

## 8. ApiTokenPanel 调整

- 外层包裹 `SettingsExpander`,默认收起
- 内部样式 token 同步替换 `--chat-*` → `--color-*` / `--accent`
- 圆角统一为 `--radius-lg` / `--radius-md`
- 按钮、输入框、chip、modal 全部使用新 token
- 业务逻辑(创建/吊销/删除/复制/帮助弹层)保持不变

## 9. 验收标准

- [ ] TypeScript 类型检查通过(`pnpm type-check` 无错误)
- [ ] ESLint 通过(`pnpm lint` 无错误)
- [ ] dev 服务器运行正常,`http://localhost:5173/new/options` 可访问
- [ ] 移动端 viewport 下视觉与 mockup 一致
- [ ] PC 端 viewport 下居中显示,最大宽度 720px
- [ ] 深色模式完整适配(banner、卡片、开关、输入框、展开区背景)
- [ ] 所有原有功能正常:头像上传、保存资料、隐藏发帖切换、邮箱推送切换、修改密码、PAT 创建/吊销/删除/复制
- [ ] PAT 面板默认收起,展开时才发起请求;收起后卸载
- [ ] `OptionsView.vue` 与 `ApiTokenPanel.vue` 内不再出现任何 `--chat-*` 变量引用
- [ ] 退出登录按钮 confirm + 清理 + 跳转流程正常

## 10. 不在本次范围

- 不修改任何后端接口
- 不修改路由路径(`/options` 保持不变)
- 不新增功能模块(如主题切换、清除缓存、关于页等)
- 不修改 `userStore` / `usePWA` 等组合式函数
- 不重构 `ApiTokenPanel` 的业务逻辑,仅替换样式 token
- 不修改 `LoginAndRegister` 模块下的 `sendCode` / `updatePassword`
- 不推送代码、不执行 `pnpm build`、不部署生产环境(用户明确要求)
