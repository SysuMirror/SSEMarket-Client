# OptionsView 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/options` 页面从 6 个并列卡片重构为「Hero 头像卡片 + 4 个 iOS 分组列表」结构,统一到全站 `--color-*` / `--accent` token 体系,拆分 7 个可复用子组件。

**Architecture:** 单一 `OptionsView.vue` 拆分为 `SettingsHero` / `SettingsGroup` / `SettingsRow` / `SettingsToggle` / `SettingsExpander` / `SettingsInput` 6 个新子组件 + 复用现有 `ApiTokenPanel`(仅替换 token)。所有接口保持不变,仅重组触发时机与 UI 反馈。PAT 面板用 `v-if` 包裹实现懒加载/卸载。

**Tech Stack:** Vue 3 `<script setup lang="ts">` + SCSS + 现有 `--color-*` / `--accent` / `--radius-*` token 体系(定义在 `src/assets/mode.css`)。

**Spec:** [docs/superpowers/specs/2026-08-16-options-view-refactor-design.md](file:///root/SSE_Market/sse_market_new_client/newSSE/docs/superpowers/specs/2026-08-16-options-view-refactor-design.md)

---

## File Structure

| 文件 | 类型 | 职责 |
|------|------|------|
| `src/components/settings/SettingsGroup.vue` | 新建 | 分组容器(标题 + 卡片 + 阴影) |
| `src/components/settings/SettingsRow.vue` | 新建 | 通用行(label + value + 箭头) |
| `src/components/settings/SettingsToggle.vue` | 新建 | 开关行(label + hint + switch) |
| `src/components/settings/SettingsExpander.vue` | 新建 | 可展开行(v-if 包裹 slot) |
| `src/components/settings/SettingsInput.vue` | 新建 | 带 label 的输入框 |
| `src/components/settings/SettingsHero.vue` | 新建 | banner + 头像 + 摘要 + 经验条 + 编辑按钮 |
| `src/components/settings/index.ts` | 新建 | 统一导出,简化 import |
| `src/views/OptionsView.vue` | 重写 | 页面容器 + 状态编排 |
| `src/components/ApiTokenPanel.vue` | 修改 | 仅替换 `--chat-*` → `--color-*` / `--accent`,圆角统一 |

**测试策略:** 此项目无单元测试框架。每个任务通过 `pnpm type-check` + `pnpm lint` + 浏览器手动验证 `http://localhost:5173/new/options`。最后一节汇总所有手动验收项。

---

## Task 1: SettingsGroup 分组容器

**Files:**
- Create: `src/components/settings/SettingsGroup.vue`

- [ ] **Step 1: 创建 SettingsGroup.vue**

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

<style scoped lang="scss">
.settings-group {
  margin-top: 18px;

  &__title {
    margin: 0 0 6px 4px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  &__card {
    background: var(--color-card);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--color-card-shadow);
  }
}
</style>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm type-check`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/SettingsGroup.vue
git commit -m "feat(settings): 新增 SettingsGroup 分组容器组件"
```

---

## Task 2: SettingsRow 通用行

**Files:**
- Create: `src/components/settings/SettingsRow.vue`

- [ ] **Step 1: 创建 SettingsRow.vue**

```vue
<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value?: string
    clickable?: boolean
    hint?: string
  }>(),
  {
    clickable: false,
    value: '',
    hint: '',
  },
)
defineEmits<{
  click: []
}>()
</script>

<template>
  <div
    class="settings-row"
    :class="{
      'settings-row--clickable': clickable,
      'settings-row--with-hint': !!hint,
    }"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="$emit('click')"
    @keydown.enter.prevent="$emit('click')"
    @keydown.space.prevent="$emit('click')"
  >
    <div class="settings-row__text">
      <span class="settings-row__label">{{ label }}</span>
      <span v-if="hint" class="settings-row__hint">{{ hint }}</span>
    </div>
    <div class="settings-row__right">
      <span v-if="value" class="settings-row__value">{{ value }}</span>
      <span v-if="clickable" class="settings-row__arrow" aria-hidden="true">›</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-card);

  &:last-child {
    border-bottom: none;
  }

  &--clickable {
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
      background: var(--color-hover);
    }
  }

  &--with-hint {
    align-items: flex-start;
  }

  &__text {
    flex: 1;
    min-width: 0;
  }

  &__label {
    display: block;
    font-size: 14px;
    color: var(--color-text);
    line-height: 1.4;
  }

  &__hint {
    display: block;
    margin-top: 2px;
    font-size: 11px;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    max-width: 60%;
  }

  &__value {
    font-size: 14px;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__arrow {
    color: var(--color-text-muted);
    font-size: 14px;
    line-height: 1;
  }
}
</style>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm type-check`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/SettingsRow.vue
git commit -m "feat(settings): 新增 SettingsRow 通用行组件"
```

---

## Task 3: SettingsToggle 开关行

**Files:**
- Create: `src/components/settings/SettingsToggle.vue`

- [ ] **Step 1: 创建 SettingsToggle.vue**

```vue
<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    hint?: string
    modelValue: boolean
    disabled?: boolean
  }>(),
  {
    hint: '',
    disabled: false,
  },
)
defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<template>
  <div class="settings-toggle">
    <div class="settings-toggle__text">
      <span class="settings-toggle__title">{{ title }}</span>
      <span v-if="hint" class="settings-toggle__hint">{{ hint }}</span>
    </div>
    <button
      type="button"
      class="settings-toggle__switch"
      :class="{ 'settings-toggle__switch--on': modelValue }"
      :disabled="disabled"
      role="switch"
      :aria-checked="modelValue"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <span class="settings-toggle__knob" />
    </button>
  </div>
</template>

<style scoped lang="scss">
.settings-toggle {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-card);

  &:last-child {
    border-bottom: none;
  }

  &__text {
    flex: 1;
    min-width: 0;
  }

  &__title {
    display: block;
    font-size: 14px;
    color: var(--color-text);
    line-height: 1.4;
  }

  &__hint {
    display: block;
    margin-top: 2px;
    font-size: 11px;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  &__switch {
    position: relative;
    flex-shrink: 0;
    width: 38px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 11px;
    background: var(--color-button-bg-secondary);
    cursor: pointer;
    transition: background 0.2s ease;
    -webkit-tap-highlight-color: transparent;

    &--on {
      background: var(--accent);
    }

    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  }

  &__knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    transition: transform 0.2s ease;
  }

  &__switch--on &__knob {
    transform: translateX(16px);
  }
}
</style>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm type-check`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/SettingsToggle.vue
git commit -m "feat(settings): 新增 SettingsToggle 开关行组件"
```

---

## Task 4: SettingsInput 输入框

**Files:**
- Create: `src/components/settings/SettingsInput.vue`

- [ ] **Step 1: 创建 SettingsInput.vue**

```vue
<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    modelValue: string
    type?: string
    placeholder?: string
    autocomplete?: string
    inputmode?: 'text' | 'numeric' | 'tel' | 'email' | 'url' | 'none'
  }>(),
  {
    type: 'text',
    placeholder: '',
    autocomplete: 'off',
    inputmode: 'text',
  },
)
defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <label class="settings-input">
    <span class="settings-input__label">{{ label }}</span>
    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :inputmode="inputmode"
      class="settings-input__field"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </label>
</template>

<style scoped lang="scss">
.settings-input {
  display: block;
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }

  &__label {
    display: block;
    margin-bottom: 5px;
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  &__field {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px;
    font-size: 14px;
    font-family: inherit;
    color: var(--color-text);
    background: var(--color-card);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    outline: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;

    &::placeholder {
      color: var(--color-text-muted);
    }

    &:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }
  }
}
</style>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm type-check`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/SettingsInput.vue
git commit -m "feat(settings): 新增 SettingsInput 输入框组件"
```

---

## Task 5: SettingsExpander 可展开行

**Files:**
- Create: `src/components/settings/SettingsExpander.vue`

- [ ] **Step 1: 创建 SettingsExpander.vue**

```vue
<script setup lang="ts">
import SettingsRow from './SettingsRow.vue'

defineProps<{
  label: string
  value?: string
  open: boolean
  hint?: string
}>()
defineEmits<{
  'update:open': [value: boolean]
}>()
</script>

<template>
  <div class="settings-expander">
    <SettingsRow
      :label="label"
      :value="value"
      :hint="hint"
      clickable
      @click="$emit('update:open', !open)"
    >
      <template #default>
        <!-- SettingsRow 默认 slot 不渲染,这里复用其布局 -->
      </template>
    </SettingsRow>
    <!-- 用 v-if 而非 v-show:确保 PAT 等面板懒加载、收起时卸载 -->
    <div v-if="open" class="settings-expander__body">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.settings-expander {
  &__body {
    padding: 14px 16px;
    background: var(--color-hover);
    border-top: 1px solid var(--color-border);
  }
}
</style>
```

**注意:** 上面的 `SettingsRow` 用法不传 `clickable` arrow 旋转效果,因为 arrow 由 SettingsRow 内部管理。但 expander 展开时需要旋转箭头。改为不依赖 SettingsRow 的箭头,自定义箭头:

替换 `<template>` 内容为:

```vue
<template>
  <div class="settings-expander">
    <div
      class="settings-expander__header"
      :class="{ 'settings-expander__header--open': open }"
      role="button"
      tabindex="0"
      @click="$emit('update:open', !open)"
      @keydown.enter.prevent="$emit('update:open', !open)"
      @keydown.space.prevent="$emit('update:open', !open)"
    >
      <div class="settings-expander__text">
        <span class="settings-expander__label">{{ label }}</span>
        <span v-if="hint" class="settings-expander__hint">{{ hint }}</span>
      </div>
      <div class="settings-expander__right">
        <span v-if="value" class="settings-expander__value">{{ value }}</span>
        <span class="settings-expander__arrow" :class="{ 'settings-expander__arrow--open': open }" aria-hidden="true">›</span>
      </div>
    </div>
    <!-- 用 v-if 而非 v-show:确保 PAT 等面板懒加载、收起时卸载 -->
    <div v-if="open" class="settings-expander__body">
      <slot />
    </div>
  </div>
</template>
```

替换 `<style>` 为:

```scss
.settings-expander {
  &__header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 16px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-card);
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
      background: var(--color-hover);
    }

    &--open {
      background: var(--color-hover);
      border-bottom: none;
    }
  }

  &__text {
    flex: 1;
    min-width: 0;
  }

  &__label {
    display: block;
    font-size: 14px;
    color: var(--color-text);
    line-height: 1.4;
  }

  &__hint {
    display: block;
    margin-top: 2px;
    font-size: 11px;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    max-width: 60%;
  }

  &__value {
    font-size: 14px;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__arrow {
    color: var(--color-text-muted);
    font-size: 14px;
    line-height: 1;
    transition: transform 0.2s ease;

    &--open {
      transform: rotate(90deg);
    }
  }

  &__body {
    padding: 14px 16px;
    background: var(--color-hover);
  }
}
```

删除 `<script setup>` 中 `import SettingsRow from './SettingsRow.vue'`,因不再使用。

最终 SettingsExpander.vue 完整内容:

```vue
<script setup lang="ts">
defineProps<{
  label: string
  value?: string
  open: boolean
  hint?: string
}>()
defineEmits<{
  'update:open': [value: boolean]
}>()
</script>

<template>
  <div class="settings-expander">
    <div
      class="settings-expander__header"
      :class="{ 'settings-expander__header--open': open }"
      role="button"
      tabindex="0"
      @click="$emit('update:open', !open)"
      @keydown.enter.prevent="$emit('update:open', !open)"
      @keydown.space.prevent="$emit('update:open', !open)"
    >
      <div class="settings-expander__text">
        <span class="settings-expander__label">{{ label }}</span>
        <span v-if="hint" class="settings-expander__hint">{{ hint }}</span>
      </div>
      <div class="settings-expander__right">
        <span v-if="value" class="settings-expander__value">{{ value }}</span>
        <span class="settings-expander__arrow" :class="{ 'settings-expander__arrow--open': open }" aria-hidden="true">›</span>
      </div>
    </div>
    <div v-if="open" class="settings-expander__body">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.settings-expander {
  &__header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 16px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-card);
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
      background: var(--color-hover);
    }

    &--open {
      background: var(--color-hover);
      border-bottom: none;
    }
  }

  &__text {
    flex: 1;
    min-width: 0;
  }

  &__label {
    display: block;
    font-size: 14px;
    color: var(--color-text);
    line-height: 1.4;
  }

  &__hint {
    display: block;
    margin-top: 2px;
    font-size: 11px;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    max-width: 60%;
  }

  &__value {
    font-size: 14px;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__arrow {
    color: var(--color-text-muted);
    font-size: 14px;
    line-height: 1;
    transition: transform 0.2s ease;

    &--open {
      transform: rotate(90deg);
    }
  }

  &__body {
    padding: 14px 16px;
    background: var(--color-hover);
  }
}
</style>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm type-check`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/SettingsExpander.vue
git commit -m "feat(settings): 新增 SettingsExpander 可展开行组件"
```

---

## Task 6: SettingsHero 头像卡片

**Files:**
- Create: `src/components/settings/SettingsHero.vue`

- [ ] **Step 1: 创建 SettingsHero.vue**

```vue
<script setup lang="ts">
defineProps<{
  avatarSrc: string
  name: string
  uid: number
  phone: string
  levelLabel: string
  levelClass: string
  expPercent: number
  score: number
  expTarget: number
  nextLevelLabel: string
}>()
defineEmits<{
  'upload-avatar': [event: Event]
  'edit-profile': []
  'avatar-error': []
}>()
</script>

<template>
  <section class="settings-hero">
    <div class="settings-hero__banner" />
    <div class="settings-hero__card">
      <div class="settings-hero__main">
        <label class="settings-hero__avatar-wrap" title="点击更换头像">
          <img
            class="settings-hero__avatar"
            :src="avatarSrc"
            alt="头像"
            loading="lazy"
            @error="$emit('avatar-error')"
          >
          <span class="settings-hero__avatar-badge" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M9 4h6l1 2h3v14H5V6h3l1-2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              <circle cx="12" cy="13" r="3" stroke="currentColor" stroke-width="2"/>
            </svg>
          </span>
          <input
            type="file"
            accept="image/*"
            class="settings-hero__file-input"
            @change="$emit('upload-avatar', $event)"
          >
        </label>
        <div class="settings-hero__info">
          <p class="settings-hero__name">{{ name || '未设置昵称' }}</p>
          <p class="settings-hero__meta">UID {{ uid || '—' }} · {{ phone || '—' }}</p>
          <div class="settings-hero__level-row">
            <span class="settings-hero__level-badge" :class="levelClass">{{ levelLabel }}</span>
            <span class="settings-hero__exp-text">{{ score }} / {{ expTarget }} 经验</span>
            <span class="settings-hero__next-level">{{ nextLevelLabel }}</span>
          </div>
          <div class="settings-hero__progress" role="progressbar" :aria-valuenow="expPercent" aria-valuemin="0" aria-valuemax="100">
            <div class="settings-hero__progress-fill" :style="{ width: `${expPercent}%` }" />
          </div>
        </div>
      </div>
      <button type="button" class="settings-hero__edit-btn" @click="$emit('edit-profile')">
        编辑资料
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.settings-hero {
  position: relative;

  &__banner {
    height: 88px;
    background: linear-gradient(135deg, var(--accent) 0%, #1e293b 100%);
  }

  &__card {
    position: relative;
    margin: -36px 0 0;
    padding: 16px;
    background: var(--color-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--color-card-shadow);
  }

  &__main {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  &__avatar-wrap {
    position: relative;
    flex-shrink: 0;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    overflow: hidden;
    cursor: pointer;
    border: 3px solid var(--color-card);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &__avatar {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: var(--accent);
  }

  &__avatar-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--color-card);
    border: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
  }

  &__file-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    font-size: 0;
  }

  &__info {
    flex: 1;
    min-width: 0;
  }

  &__name {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
    word-break: break-word;
  }

  &__meta {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  &__level-row {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  &__level-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 500;
    background: var(--accent-soft);
    color: var(--accent);
  }

  &__exp-text {
    font-size: 11px;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  &__next-level {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  &__progress {
    margin-top: 6px;
    height: 4px;
    background: var(--color-button-bg-secondary);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  &__progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: var(--radius-full);
    transition: width 0.35s ease;
  }

  &__edit-btn {
    margin-top: 14px;
    width: 100%;
    padding: 9px 12px;
    background: var(--color-button-bg-secondary);
    border: none;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
      background: var(--color-hover);
    }
  }
}
</style>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm type-check`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/SettingsHero.vue
git commit -m "feat(settings): 新增 SettingsHero 头像卡片组件"
```

---

## Task 7: 统一导出 index.ts

**Files:**
- Create: `src/components/settings/index.ts`

- [ ] **Step 1: 创建 index.ts**

```typescript
export { default as SettingsGroup } from './SettingsGroup.vue'
export { default as SettingsRow } from './SettingsRow.vue'
export { default as SettingsToggle } from './SettingsToggle.vue'
export { default as SettingsExpander } from './SettingsExpander.vue'
export { default as SettingsInput } from './SettingsInput.vue'
export { default as SettingsHero } from './SettingsHero.vue'
```

- [ ] **Step 2: 类型检查**

Run: `pnpm type-check`
Expected: 无新增错误

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/index.ts
git commit -m "feat(settings): 新增 settings 组件统一导出"
```

---

## Task 8: 重写 OptionsView.vue

**Files:**
- Modify: `src/views/OptionsView.vue`(完全重写)

- [ ] **Step 1: 完整重写 OptionsView.vue**

```vue
<script setup lang="ts">
import type { Ref } from 'vue'
import type { AllInfo } from '@/api/info/getInfo'
import { computed, inject, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getAllInfo, isEmailNotificationBlocked, normalizeAllInfo } from '@/api/info/getInfo'
import { updateEmailPush, updateUserInfo, uploadAvatar } from '@/api/info/updateInfo'
import { updatePassword } from '@/api/LoginAndRegister/forgetPwd'
import { sendCode } from '@/api/LoginAndRegister/utils'
import ApiTokenPanel from '@/components/ApiTokenPanel.vue'
import { SettingsExpander, SettingsGroup, SettingsHero, SettingsInput, SettingsToggle } from '@/components/settings'
import { showMsg } from '@/components/MessageBox'
import { usePWA } from '@/composables/usePWA'
import { useUserStore } from '@/store/userStore'
import { levelClassHandler, levelExpHandler, levelNameHandler } from '@/utils/level'

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

const defaultAvatar = `${import.meta.env.BASE_URL}default-avatar.svg`
const settingsAvatarSrc = ref(defaultAvatar)

const isPushDisabled = ref(false)
const hidePostsSyncing = ref(false)

// 各 expander 独立 open 状态
const userNameOpen = ref(false)
const userIntroOpen = ref(false)
const passwordOpen = ref(false)
const patOpen = ref(false)

// 表单本地状态(独立于 allInfo,避免污染主状态)
const passwordForm = ref({ vcode: '', password1: '', password2: '' })
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

async function reloadSettingsFromServer() {
  const info = normalizeAllInfo(await getAllInfo(userInfo.phone))
  allInfo.value = info
  isPushDisabled.value = isEmailNotificationBlocked(
    info.emailNotificationBlocked ?? info.emailpush,
  )
}

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
  nextTick(() => {
    accountGroupRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

// 用户名编辑:展开时初始化 draft,保存时写回 allInfo
function openUserName() {
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

function openUserIntro() {
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

onMounted(() => {
  void reloadSettingsFromServer()
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
        @update:open="(v) => v && openUserName()"
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
        @update:open="(v) => v && openUserIntro()"
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
    </SettingsGroup>

    <!-- 分组 3: 通用 -->
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

    <!-- 分组 4: 开发者(默认折叠) -->
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
</style>
```

- [ ] **Step 2: 类型检查**

Run: `pnpm type-check`
Expected: 无新增错误

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: 无新增错误

- [ ] **Step 4: 浏览器验证**

打开 `http://localhost:5173/new/options`:
- Hero 头像卡片显示在藏青 banner 上
- 4 个分组依次展示,标题 12px/500/muted 灰
- 「用户名」「个人简介」「修改密码」「PAT」均显示 `›` 箭头
- 两个开关(隐藏发帖 / 禁用推送)显示正确状态
- PAT 面板默认收起,Network 面板无 `listAPITokenScopes` / `listAPITokens` 请求

- [ ] **Step 5: Commit**

```bash
git add src/views/OptionsView.vue
git commit -m "refactor(options): 重写为 Hero + 分组列表结构"
```

---

## Task 9: ApiTokenPanel token 替换

**Files:**
- Modify: `src/components/ApiTokenPanel.vue`(仅 `<style>` 部分,逻辑不动)

- [ ] **Step 1: 读取当前 ApiTokenPanel.vue 的 style 部分**

Run: `grep -n "chat-" src/components/ApiTokenPanel.vue` (用 IDE Grep 工具)
Expected: 列出所有 `--chat-*` 引用行

- [ ] **Step 2: 批量替换 token**

用 IDE Edit 工具按以下映射逐个替换:

| 旧 | 新 |
|----|-----|
| `--chat-bg-main` | `--color-bg` |
| `--chat-bg-highlight` | `--color-card` |
| `--chat-border` | `--color-border` |
| `--chat-border-strong` | `--color-border-strong` |
| `--chat-text` | `--color-text` |
| `--chat-text-secondary` | `--color-text-secondary` |
| `--chat-text-tips` | `--color-text-muted` |
| `--chat-accent` | `--accent` |
| `--chat-accent-soft` | `--accent-soft` |
| `border-radius: 20px` | `border-radius: var(--radius-lg)` |
| `border-radius: 14px` | `border-radius: var(--radius-md)` |
| `border-radius: 12px` | `border-radius: var(--radius-md)` |

**注意:** 只替换 `<style>` 标签内的内容,`<script setup>` 和 `<template>` 不动。

- [ ] **Step 3: 验证无残留**

Run Grep: pattern=`chat-`,path=`src/components/ApiTokenPanel.vue`,output_mode=`count`
Expected: 0

- [ ] **Step 4: 类型检查 + Lint**

Run: `pnpm type-check && pnpm lint`
Expected: 无新增错误

- [ ] **Step 5: 浏览器验证**

打开 `http://localhost:5173/new/options`:
- 点击「开发者」分组的「个人访问令牌(PAT)」展开
- Network 面板看到 `listAPITokenScopes` + `listAPITokens` 请求触发
- 面板内卡片圆角、阴影、按钮颜色与外层分组列表一致
- 点击创建 token、复制、吊销、删除等功能正常

- [ ] **Step 6: Commit**

```bash
git add src/components/ApiTokenPanel.vue
git commit -m "refactor(ApiTokenPanel): 替换 --chat-* 为 --color-* 体系"
```

---

## Task 10: 最终验收

- [ ] **Step 1: 全量类型检查**

Run: `pnpm type-check`
Expected: PASS,无新增错误

- [ ] **Step 2: 全量 Lint**

Run: `pnpm lint`
Expected: PASS,无新增错误

- [ ] **Step 3: 残留 chat-* 检查**

Run Grep: pattern=`chat-`,path=`src/views/OptionsView.vue`,output_mode=`count`
Expected: 0

Run Grep: pattern=`chat-`,path=`src/components/ApiTokenPanel.vue`,output_mode=`count`
Expected: 0

- [ ] **Step 4: 移动端视觉验证**

调整浏览器 viewport 至 375×667(iPhone SE):
- Hero 卡片浮在 banner 上,头像 60×60,「编辑资料」按钮全宽
- 4 个分组之间间距 18px,标题 12px/500
- 行高 13px,字号 14px
- 开关 38×22,knob 平滑滑动
- 「修改密码」展开后表单字段全宽,「发送验证码」「重置密码」按钮全宽
- PAT 面板展开后内容不溢出
- 退出登录按钮全宽,红色边框 + 红色文字

- [ ] **Step 5: PC 端视觉验证**

调整浏览器 viewport 至 1280×800:
- 内容区居中,max-width 720px
- 左右两侧留白对称
- 「电脑端样式新体验」开关出现在「通用」分组(因 `isPC = true`)

- [ ] **Step 6: 深色模式验证**

切换系统/浏览器到深色模式:
- banner 仍为藏青渐变,但深色变体更深
- 卡片背景为深色 `--color-card` 深色值
- 开关关闭态为深色 `--color-button-bg-secondary`
- 输入框边框、展开区背景适配深色
- 退出登录按钮红色边框在深色下仍清晰可见

- [ ] **Step 7: 功能回归测试**

按顺序在 `http://localhost:5173/new/options` 测试:
1. **头像上传**:点击 Hero 头像 → 选图 → 头像即时更新 → 重新加载页面后仍保留
2. **编辑资料按钮**:点击 Hero 「编辑资料」→ 页面平滑滚动到「账号资料」→ 「用户名」表单展开
3. **保存用户名**:展开「用户名」→ 改值 → 点保存 → toast 提示 → 表单收起
4. **保存简介**:同上
5. **隐藏发帖切换**:切换开关 → 关闭页面重进 → 状态保留
6. **邮箱推送切换**:切换 → toast 提示 → 状态保留
7. **修改密码**:展开 → 发送验证码 → 填写 → 重置 → toast → 表单清空 + 收起
8. **PAT 展开**:点击展开 → 请求触发 → 列表加载
9. **PAT 收起**:再次点击 → 面板卸载(DevTools 检查内存或重新展开看是否重新请求)
10. **退出登录**:点击 → confirm → 跳首页

- [ ] **Step 8: 最终 Commit**

如所有验收通过,创建一个汇总 commit:

```bash
git add -A
git commit -m "feat(options): 完成重构 - Hero + 分组列表 + token 统一"
```

(可选:推送 `git push`,但用户明确要求不部署,此步骤跳过)
