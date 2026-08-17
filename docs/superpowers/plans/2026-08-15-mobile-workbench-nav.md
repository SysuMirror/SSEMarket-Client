# 移动端底部导航重构 + 工作台页面 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将移动端底部导航压缩为 5 项（主页/消息/+发帖/工作台/我的），新建工作台页面收纳排行榜、小秋、简历、商城、iWiki、课程专区及全部 10 个分区入口；同时将 MobileHeader 左侧的课程图标替换为小秋入口。

**Architecture:** 新建独立路由 `/workbench` 与 `WorkbenchView.vue` 视图，采用 4 列宫格布局（CSS Grid）。改造 `BottomNavbar.vue` 移除 3 项、新增 2 项（中间凸起"+发帖"按钮 + 工作台入口）。MobileHeader 仅替换左侧 RouterLink 的目标与图标。所有改动仅影响移动端（≤768px），PC 端 PcHeader 不动。

**Tech Stack:** Vue 3.5 + Vue Router 4 + TypeScript + Vite 7 + UnoCSS + SCSS + @iconify/vue (tabler icons)

**Spec:** `docs/superpowers/specs/2026-08-15-mobile-workbench-nav-design.md`

---

## File Structure

| 文件                              | 改动类型 | 责任                                                           |
| --------------------------------- | -------- | -------------------------------------------------------------- |
| `src/views/WorkbenchView.vue`     | 新建     | 工作台页面：4 列宫格，常用组 6 项 + 全部分区组 10 项           |
| `src/router/index.ts`             | 修改     | 在 DefaultLayout children 中新增 `/workbench` 路由             |
| `src/components/BottomNavbar.vue` | 修改     | 移除排行榜/小秋/简历 3 项，新增中间凸起"+发帖"按钮与工作台入口 |
| `src/components/MobileHeader.vue` | 修改     | 左侧课程图标 → 小秋图标（搜索框/发帖按钮不动）                 |

不改动：`PcHeader.vue`、`PwaPcHeader.vue`、`PartitionList.vue`、`DefaultLayout.vue`、`main.css`。

---

### Task 1: 新增 `/workbench` 路由

**Files:**

- Modify: `src/router/index.ts:175-202`（DefaultLayout children 末尾，shop 路由块之后）

- [ ] **Step 1: 在 DefaultLayout children 末尾追加 workbench 路由**

打开 `src/router/index.ts`，定位到第 201 行（shop 路由块结束的 `},` 之后、第 202 行 `],` 之前），插入新路由。

将：

```ts
        {
          path: 'shop',
          name: 'ShopLayout',
          component: () => import('@/layouts/ShopLayout.vue'),
          children: [
            {
              path: '',
              name: 'Shop',
              component: () => import('@/views/ShopView.vue'),
            },
            {
              path: 'myproducts',
              name: 'MyProducts',
              component: () => import('@/views/ShopView.vue'),
            },
            {
              path: 'productdetail/:ProductID',
              name: 'Productdetail',
              component: () => import('@/views/ProductView.vue'),
              props: true,
            },
            {
              path: 'sale',
              name: 'Sale',
              component: () => import('@/views/SaleView.vue'),
            },
          ],
        },

      ],
```

改为：

```ts
        {
          path: 'shop',
          name: 'ShopLayout',
          component: () => import('@/layouts/ShopLayout.vue'),
          children: [
            {
              path: '',
              name: 'Shop',
              component: () => import('@/views/ShopView.vue'),
            },
            {
              path: 'myproducts',
              name: 'MyProducts',
              component: () => import('@/views/ShopView.vue'),
            },
            {
              path: 'productdetail/:ProductID',
              name: 'Productdetail',
              component: () => import('@/views/ProductView.vue'),
              props: true,
            },
            {
              path: 'sale',
              name: 'Sale',
              component: () => import('@/views/SaleView.vue'),
            },
          ],
        },
        {
          path: 'workbench',
          name: 'Workbench',
          component: () => import('@/views/WorkbenchView.vue'),
        },

      ],
```

- [ ] **Step 2: 验证路由注册（此时 WorkbenchView.vue 尚未创建，dev server 会报错，属预期）**

Run: `pnpm type-check`
Expected: 暂时跳过，等 Task 2 完成后一并验证

- [ ] **Step 3: Commit**

```bash
git add src/router/index.ts
git commit -m "feat(router): add /workbench route"
```

---

### Task 2: 创建工作台视图 `WorkbenchView.vue`

**Files:**

- Create: `src/views/WorkbenchView.vue`

- [ ] **Step 1: 创建 WorkbenchView.vue 文件，写入完整内容**

文件路径：`src/views/WorkbenchView.vue`

```vue
<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { CONTENT_PARTITIONS } from '@/constants/partitions'

/** 常用入口：固定 6 项，iWiki 为外链 */
interface CommonEntry {
  key: string
  label: string
  icon: string
  to?: string
  href?: string
}

const commonEntries: CommonEntry[] = [
  { key: 'ranking', label: '排行榜', icon: 'tabler:trophy', to: '/ranking' },
  { key: 'xiaoqiu', label: '小秋', icon: 'tabler:sparkles', to: '/smart-xiaoqiu' },
  { key: 'resume', label: '简历', icon: 'tabler:file-cv', to: '/resume' },
  { key: 'shop', label: '商城', icon: 'tabler:shopping-bag', to: '/shop' },
  { key: 'iwiki', label: 'iWiki', icon: 'tabler:book-2', href: 'https://ssemarket.cn/iwiki/' },
  { key: 'course', label: '课程专区', icon: 'tabler:book', to: '/course' },
]

const partitions = CONTENT_PARTITIONS
</script>

<template>
  <div class="workbench">
    <h1 class="workbench__title">
      工作台
    </h1>

    <section class="workbench__section">
      <h2 class="workbench__section-title">
        常用
      </h2>
      <div class="workbench__grid">
        <a
          v-for="entry in commonEntries"
          :key="entry.key"
          class="wb-cell"
          :class="`wb-cell--${entry.key}`"
          :href="entry.href"
          :target="entry.href ? '_blank' : undefined"
          :rel="entry.href ? 'noopener noreferrer' : undefined"
          @click="entry.href ? null : undefined"
        >
          <span v-if="entry.to" class="wb-cell__router-wrap">
            <RouterLink :to="entry.to" class="wb-cell__link">
              <span class="wb-cell__icon-wrap">
                <Icon :icon="entry.icon" class="wb-cell__icon" width="28" height="28" aria-hidden="true" />
              </span>
              <span class="wb-cell__label">{{ entry.label }}</span>
            </RouterLink>
          </span>
          <template v-else>
            <span class="wb-cell__link">
              <span class="wb-cell__icon-wrap">
                <Icon :icon="entry.icon" class="wb-cell__icon" width="28" height="28" aria-hidden="true" />
              </span>
              <span class="wb-cell__label">{{ entry.label }}</span>
            </span>
          </template>
        </a>
      </div>
    </section>

    <section class="workbench__section">
      <h2 class="workbench__section-title">
        全部分区
      </h2>
      <div class="workbench__grid">
        <RouterLink
          v-for="p in partitions"
          :key="p.key"
          class="wb-cell"
          :class="`wb-cell--${p.key}`"
          :to="`/partition/${encodeURIComponent(p.name)}`"
        >
          <span class="wb-cell__link">
            <span class="wb-cell__icon-wrap">
              <Icon :icon="p.icon" class="wb-cell__icon" width="28" height="28" aria-hidden="true" />
            </span>
            <span class="wb-cell__label">{{ p.name }}</span>
          </span>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.workbench {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 8px 12px 20px;
  box-sizing: border-box;
  color: var(--chat-text, var(--color-text));
}

.workbench__title {
  margin: 0 0 12px;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--chat-text, var(--color-text));
}

.workbench__section {
  margin-bottom: 20px;
}

.workbench__section-title {
  margin: 0 0 10px;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--chat-text-secondary, #64748b);
}

.workbench__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.wb-cell {
  display: block;
  padding: 10px 6px;
  border-radius: 12px;
  background: var(--chat-bg-highlight, #fff);
  border: 1px solid var(--chat-border, #e2e8f0);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
  text-decoration: none;
  color: inherit;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    border-color: var(--chat-border-strong, #cbd5e1);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.07);
  }

  &:active {
    transform: scale(0.97);
  }
}

.wb-cell__router-wrap {
  display: block;
  width: 100%;
  height: 100%;
}

.wb-cell__link {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-decoration: none;
  color: inherit;
}

.wb-cell__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--chat-bg-main, #f1f5f9);
}

.wb-cell__icon {
  flex-shrink: 0;
  opacity: 0.95;
}

.wb-cell__label {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  text-align: center;
  color: var(--chat-text, var(--color-text));
}

/* 常用组图标语义色 */
.wb-cell--ranking .wb-cell__icon {
  color: #eab308;
}
.wb-cell--xiaoqiu .wb-cell__icon {
  color: #7c3aed;
}
.wb-cell--resume .wb-cell__icon {
  color: #0d9488;
}
.wb-cell--shop .wb-cell__icon {
  color: #059669;
}
.wb-cell--iwiki .wb-cell__icon {
  color: #6366f1;
}
.wb-cell--course .wb-cell__icon {
  color: #ea580c;
}

/* 全部分区组图标语义色（与 PartitionList 保持一致） */
.wb-cell--study .wb-cell__icon {
  color: #0d9488;
}
.wb-cell--daily-life .wb-cell__icon {
  color: #db2777;
}
.wb-cell--club .wb-cell__icon {
  color: #8b5cf6;
}
.wb-cell--internship .wb-cell__icon {
  color: #1d4ed8;
}
.wb-cell--materials .wb-cell__icon {
  color: #ca8a04;
}
.wb-cell--dormitory .wb-cell__icon {
  color: #059669;
}
.wb-cell--tech .wb-cell__icon {
  color: #2563eb;
}
.wb-cell--team-up .wb-cell__icon {
  color: #f97316;
}
.wb-cell--misc .wb-cell__icon {
  color: #78716c;
}

/* 深色模式 */
body.dark-mode .wb-cell {
  background: var(--chat-bg-highlight, #1e293b);
  border-color: var(--chat-border, #334155);
}

body.dark-mode .wb-cell__icon-wrap {
  background: var(--chat-bg-main, #0f172a);
}

body.dark-mode .wb-cell--ranking .wb-cell__icon {
  color: #fbbf24;
}
body.dark-mode .wb-cell--xiaoqiu .wb-cell__icon {
  color: #c4b5fd;
}
body.dark-mode .wb-cell--resume .wb-cell__icon {
  color: #2dd4bf;
}
body.dark-mode .wb-cell--shop .wb-cell__icon {
  color: #34d399;
}
body.dark-mode .wb-cell--iwiki .wb-cell__icon {
  color: #a5b4fc;
}
body.dark-mode .wb-cell--course .wb-cell__icon {
  color: #fdba74;
}

body.dark-mode .wb-cell--study .wb-cell__icon {
  color: #5eead4;
}
body.dark-mode .wb-cell--daily-life .wb-cell__icon {
  color: #f9a8d4;
}
body.dark-mode .wb-cell--club .wb-cell__icon {
  color: #c4b5fd;
}
body.dark-mode .wb-cell--internship .wb-cell__icon {
  color: #93c5fd;
}
body.dark-mode .wb-cell--materials .wb-cell__icon {
  color: #fcd34d;
}
body.dark-mode .wb-cell--dormitory .wb-cell__icon {
  color: #34d399;
}
body.dark-mode .wb-cell--tech .wb-cell__icon {
  color: #93c5fd;
}
body.dark-mode .wb-cell--team-up .wb-cell__icon {
  color: #fdba74;
}
body.dark-mode .wb-cell--misc .wb-cell__icon {
  color: #a8a29e;
}
</style>
```

- [ ] **Step 2: 启动 dev server 验证页面渲染**

Run: `pnpm dev`（如已运行可跳过，浏览器直接访问）

浏览器访问 `http://localhost:5173/new/workbench`，预期：

- 顶部显示"工作台"标题
- "常用"段显示 6 个格子（4+2 换行）：排行榜、小秋、简历、商城、iWiki、课程专区
- "全部分区"段显示 10 个格子（4+4+2 换行）
- 点击排行榜/小秋/简历/商城/课程专区可正常跳转
- 点击 iWiki 在新标签打开 `https://ssemarket.cn/iwiki/`
- 点击全部分区任一格可跳到 `/partition/{name}`
- 深色模式下颜色正确

- [ ] **Step 3: 类型检查**

Run: `pnpm type-check`
Expected: 无新增类型错误

- [ ] **Step 4: Commit**

```bash
git add src/views/WorkbenchView.vue
git commit -m "feat(workbench): add WorkbenchView with 4-col grid (6 common + 10 partitions)"
```

---

### Task 3: 改造 `BottomNavbar.vue` - script 部分

**Files:**

- Modify: `src/components/BottomNavbar.vue:1-46`

- [ ] **Step 1: 替换 script 块，移除排行榜/小秋/简历 computed，新增 workbench computed**

将 `src/components/BottomNavbar.vue` 第 1-46 行的 `<script setup lang="ts">` 块替换为：

```ts
<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { handleHomeNavClick } from '@/utils/scrollHome'

const { noticeNum = 0, chatNum = 0 } = defineProps<{
  noticeNum?: number
  chatNum?: number
}>()

const route = useRoute()
const path = computed(() => route.path)

const isHome = computed(() => path.value === '/' || path.value === '/partition' || path.value.startsWith('/partition/'))
const isMessages = computed(() =>
  path.value === '/messages' || path.value === '/notice' || path.value === '/chat',
)
const totalMessageNum = computed(() => (noticeNum || 0) + (chatNum || 0))
const isWorkbench = computed(() => path.value === '/workbench')
const isPost = computed(() => path.value === '/post')
const myRoutes = ['/options', '/save', '/history', '/feedback']
const isMySection = computed(() => myRoutes.some(p => path.value === p || path.value.startsWith(`${p}/`)))

const myMenuVisible = ref(false)

function toggleMyMenu() {
  myMenuVisible.value = !myMenuVisible.value
}

function closeMyMenu() {
  myMenuVisible.value = false
}

function onHomeNavClick(e: MouseEvent) {
  closeMyMenu()
  handleHomeNavClick(e, route)
}

function onDocClick(e: MouseEvent) {
  const el = e.target as Node
  const root = document.getElementById('bottomNavBar')
  if (myMenuVisible.value && root && !root.contains(el))
    myMenuVisible.value = false
}

watch(() => route.path, () => {
  myMenuVisible.value = false
})

onMounted(() => {
  document.addEventListener('click', onDocClick)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
})
</script>
```

- [ ] **Step 2: 暂不验证（template 还未同步，下一步完成）**

---

### Task 4: 改造 `BottomNavbar.vue` - template 部分

**Files:**

- Modify: `src/components/BottomNavbar.vue:48-120`

- [ ] **Step 1: 替换 template 中的导航项**

将 `src/components/BottomNavbar.vue` 的 `<template>` 块内、`<div class="bottom-nav__inner">` 下的所有 RouterLink 替换。

将：

```vue
    <div class="bottom-nav__inner">
      <RouterLink
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': isHome }"
        to="/"
        @click="onHomeNavClick"
      >
        <Icon icon="tabler:home" class="bottom-nav__icon bottom-nav__icon--home" width="24" height="24" aria-hidden="true" />
        <span class="bottom-nav__text">主页</span>
      </RouterLink>

      <RouterLink
        class="bottom-nav__item bottom-nav__item--badge-wrap"
        :class="{ 'bottom-nav__item--active': isMessages }"
        to="/messages"
        @click="closeMyMenu"
      >
        <span class="bottom-nav__icon-slot">
          <span v-if="totalMessageNum > 0" class="bottom-nav__badge">{{ totalMessageNum > 99 ? '99+' : totalMessageNum }}</span>
          <Icon icon="tabler:messages" class="bottom-nav__icon bottom-nav__icon--messages" width="24" height="24" aria-hidden="true" />
        </span>
        <span class="bottom-nav__text">消息</span>
      </RouterLink>

      <RouterLink
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': isRanking }"
        to="/ranking"
        @click="closeMyMenu"
      >
        <Icon icon="tabler:trophy" class="bottom-nav__icon bottom-nav__icon--ranking" width="24" height="24" aria-hidden="true" />
        <span class="bottom-nav__text">排行榜</span>
      </RouterLink>

      <RouterLink
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': isSmartXiaoQiu }"
        to="/smart-xiaoqiu"
        @click="closeMyMenu"
      >
        <Icon icon="tabler:sparkles" class="bottom-nav__icon bottom-nav__icon--xiaoqiu" width="24" height="24" aria-hidden="true" />
        <span class="bottom-nav__text">小秋</span>
      </RouterLink>

      <RouterLink
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': isResume }"
        to="/resume"
        @click="closeMyMenu"
      >
        <Icon icon="tabler:file-cv" class="bottom-nav__icon bottom-nav__icon--resume" width="24" height="24" aria-hidden="true" />
        <span class="bottom-nav__text">简历</span>
      </RouterLink>

      <div class="bottom-nav__item bottom-nav__item--my" :class="{ 'bottom-nav__item--active': isMySection }">
```

改为：

```vue
    <div class="bottom-nav__inner">
      <RouterLink
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': isHome }"
        to="/"
        @click="onHomeNavClick"
      >
        <Icon icon="tabler:home" class="bottom-nav__icon bottom-nav__icon--home" width="24" height="24" aria-hidden="true" />
        <span class="bottom-nav__text">主页</span>
      </RouterLink>

      <RouterLink
        class="bottom-nav__item bottom-nav__item--badge-wrap"
        :class="{ 'bottom-nav__item--active': isMessages }"
        to="/messages"
        @click="closeMyMenu"
      >
        <span class="bottom-nav__icon-slot">
          <span v-if="totalMessageNum > 0" class="bottom-nav__badge">{{ totalMessageNum > 99 ? '99+' : totalMessageNum }}</span>
          <Icon icon="tabler:messages" class="bottom-nav__icon bottom-nav__icon--messages" width="24" height="24" aria-hidden="true" />
        </span>
        <span class="bottom-nav__text">消息</span>
      </RouterLink>

      <RouterLink
        class="bottom-nav__item bottom-nav__item--post"
        :class="{ 'bottom-nav__item--active': isPost }"
        to="/post"
        @click="closeMyMenu"
        aria-label="发帖"
      >
        <span class="bottom-nav__post-btn" />
        <span class="bottom-nav__text">发帖</span>
      </RouterLink>

      <RouterLink
        class="bottom-nav__item"
        :class="{ 'bottom-nav__item--active': isWorkbench }"
        to="/workbench"
        @click="closeMyMenu"
      >
        <Icon icon="tabler:grid-dots" class="bottom-nav__icon bottom-nav__icon--workbench" width="24" height="24" aria-hidden="true" />
        <span class="bottom-nav__text">工作台</span>
      </RouterLink>

      <div class="bottom-nav__item bottom-nav__item--my" :class="{ 'bottom-nav__item--active': isMySection }">
```

- [ ] **Step 2: 暂不验证（样式还没加，下一步完成）**

---

### Task 5: 改造 `BottomNavbar.vue` - style 部分

**Files:**

- Modify: `src/components/BottomNavbar.vue:200-470`（样式块）

- [ ] **Step 1: 在 `.bottom-nav__icon--messages` 色值后追加 post 与 workbench 相关样式**

定位到 `src/components/BottomNavbar.vue` 中的：

```scss
.bottom-nav__icon--messages {
  color: #2563eb;
}
.bottom-nav__icon--ranking {
  color: #eab308;
}
.bottom-nav__icon--xiaoqiu {
  color: #7c3aed;
}
.bottom-nav__icon--resume {
  color: #0d9488;
}
.bottom-nav__icon--user {
  color: #475569;
}
```

替换为：

```scss
.bottom-nav__icon--messages {
  color: #2563eb;
}
.bottom-nav__icon--workbench {
  color: #6366f1;
}
.bottom-nav__icon--user {
  color: #475569;
}
```

- [ ] **Step 2: 在 `.bottom-nav__item--badge-wrap` 规则后追加 `--post` 凸起按钮样式**

定位到：

```scss
  &--badge-wrap {
    position: relative;
  }

  &--my {
    flex: 1;
    padding: 0;
  }
}
```

替换为：

```scss
  &--badge-wrap {
    position: relative;
  }

  &--post {
    position: relative;
    flex: 1;
    overflow: visible;
  }

  &--my {
    flex: 1;
    padding: 0;
  }
}
```

- [ ] **Step 3: 在 `.bottom-nav__icon--messages` 色值块下方追加 `.bottom-nav__post-btn` 圆形凸起按钮样式**

紧接上一步添加的 `.bottom-nav__icon--workbench` 后面，新增：

```scss
.bottom-nav__post-btn {
  display: block;
  width: 44px;
  height: 44px;
  margin-top: -14px;
  border-radius: 50%;
  background-color: var(--chat-accent, #2c3d56);
  background-image: url('https://ssemarket.cn/new/webp/sendPostButton.webp');
  background-size: 60% 60%;
  background-repeat: no-repeat;
  background-position: center;
  box-shadow:
    0 2px 8px rgba(15, 23, 42, 0.18),
    0 0 0 3px var(--chat-bg-highlight, #fff);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.bottom-nav__item--post:hover .bottom-nav__post-btn {
  transform: translateY(-2px);
  box-shadow:
    0 4px 12px rgba(15, 23, 42, 0.24),
    0 0 0 3px var(--chat-bg-highlight, #fff);
}

body.dark-mode .bottom-nav__post-btn {
  background-color: var(--chat-accent, #60a5fa);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.4),
    0 0 0 3px var(--chat-bg-highlight, #1e293b);
}
```

- [ ] **Step 4: 在深色模式色值块中追加 workbench 深色色值，移除 ranking/xiaoqiu/resume 深色色值**

定位到：

```scss
body.dark-mode .bottom-nav__icon--home {
  color: #fb923c;
}
body.dark-mode .bottom-nav__icon--shop {
  color: #34d399;
}
body.dark-mode .bottom-nav__icon--messages {
  color: #60a5fa;
}
body.dark-mode .bottom-nav__icon--ranking {
  color: #fbbf24;
}
body.dark-mode .bottom-nav__icon--xiaoqiu {
  color: #c4b5fd;
}
body.dark-mode .bottom-nav__icon--resume {
  color: #2dd4bf;
}
body.dark-mode .bottom-nav__icon--user {
  color: #94a3b8;
}
```

替换为：

```scss
body.dark-mode .bottom-nav__icon--home {
  color: #fb923c;
}
body.dark-mode .bottom-nav__icon--messages {
  color: #60a5fa;
}
body.dark-mode .bottom-nav__icon--workbench {
  color: #a5b4fc;
}
body.dark-mode .bottom-nav__icon--user {
  color: #94a3b8;
}
```

- [ ] **Step 5: 浏览器验证底部导航**

切换到移动端响应式（Chrome DevTools → iPhone SE 375px），预期：

- 底部显示 5 项：主页 / 消息 / 圆形凸起"+"发帖按钮 / 工作台 / 我的
- 中间"+"按钮为圆形，垂直凸起于导航条上方，使用 `sendPostButton.webp` 作为内容
- 点击主页 → 跳 `/`
- 点击消息 → 跳 `/messages`，有未读数时显示角标
- 点击"+" → 跳 `/post`
- 点击工作台 → 跳 `/workbench`
- 点击"我的" → 弹出下拉菜单，5 项功能正常
- 深色模式下"+"按钮背景色与边框圈颜色正确

- [ ] **Step 6: 类型检查**

Run: `pnpm type-check`
Expected: 无新增类型错误

- [ ] **Step 7: Commit**

```bash
git add src/components/BottomNavbar.vue
git commit -m "feat(nav): restructure mobile bottom nav to 5 items with centered post button"
```

---

### Task 6: 替换 `MobileHeader.vue` 左侧入口为小秋

**Files:**

- Modify: `src/components/MobileHeader.vue:1-25`

- [ ] **Step 1: 修改 script 部分，引入 Icon 组件**

将 `src/components/MobileHeader.vue` 顶部 `<script lang="ts" setup>` 块替换。

将：

```ts
<script lang="ts" setup>
import { useTemplateRef } from 'vue'
import { useHeaderSearch } from '@/composables/useHeaderSearch'

const sinfo = useTemplateRef<HTMLInputElement>('sinfo')
const {
  onSearchInput,
  search,
  searchModeButtonText,
  searchPlaceholder,
  showRollingPlaceholder,
  toggleSearchMode,
} = useHeaderSearch(sinfo)
</script>
```

改为：

```ts
<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { useTemplateRef } from 'vue'
import { useHeaderSearch } from '@/composables/useHeaderSearch'

const sinfo = useTemplateRef<HTMLInputElement>('sinfo')
const {
  onSearchInput,
  search,
  searchModeButtonText,
  searchPlaceholder,
  showRollingPlaceholder,
  toggleSearchMode,
} = useHeaderSearch(sinfo)
</script>
```

- [ ] **Step 2: 替换 template 中的课程图标 RouterLink**

定位到 `src/components/MobileHeader.vue` 中的：

```vue
    <RouterLink
      to="/course"
      class="lesson"
      style="
              background-image: url(https://img.icons8.com/?size=100&id=kmUrp7YjifpP&format=png&color=000000);
            "
    />
```

替换为：

```vue
    <RouterLink
      to="/smart-xiaoqiu"
      class="lesson lesson--xiaoqiu"
      aria-label="智能小秋"
    >
      <Icon icon="tabler:sparkles" width="24" height="24" aria-hidden="true" />
    </RouterLink>
```

- [ ] **Step 3: 调整 `.lesson` CSS 以兼容图标（保留尺寸，移除背景图依赖）**

定位到 `src/components/MobileHeader.vue` 中的：

```scss
/* 课程专区（暂时） */
.lesson {
  width: 26px;
  height: 26px;
  background-size: cover;
  background-repeat: no-repeat;
  background-size: contain;
  background-position: 0px 3px;
  display: inline-block;
}

body.dark-mode .lesson {
  filter: brightness(1.1) saturate(1.2) drop-shadow(0 0 6px rgba(150, 200, 255, 0.4))
    drop-shadow(0 0 10px rgba(150, 200, 255, 0.2));
}
```

替换为：

```scss
/* 移动端顶栏左侧入口（小秋） */
.lesson {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #7c3aed;
}

.lesson--xiaoqiu {
  color: #7c3aed;
}

body.dark-mode .lesson {
  filter: brightness(1.1) saturate(1.2) drop-shadow(0 0 6px rgba(150, 200, 255, 0.4))
    drop-shadow(0 0 10px rgba(150, 200, 255, 0.2));
}

body.dark-mode .lesson--xiaoqiu {
  color: #c4b5fd;
}
```

- [ ] **Step 4: 浏览器验证 MobileHeader**

切换移动端响应式（iPhone SE 375px），预期：

- 顶栏左侧图标变为"小秋"sparkles 图标，紫色
- 点击跳转 `/smart-xiaoqiu`
- 搜索框正常输入与搜索
- 右侧发帖按钮不变
- 深色模式下小秋图标颜色变浅紫色

- [ ] **Step 5: 类型检查**

Run: `pnpm type-check`
Expected: 无新增类型错误

- [ ] **Step 6: Commit**

```bash
git add src/components/MobileHeader.vue
git commit -m "feat(header): replace mobile header course icon with xiaoqiu entry"
```

---

### Task 7: 端到端验证

**Files:**

- 无文件改动，仅验证

- [ ] **Step 1: 移动端全链路验证（iPhone SE 375px）**

逐项验证：

1. 底部导航 5 项显示正确，中间"+"圆形凸起
2. 主页 → 顶部分区横条仍正常显示
3. 主页 → 点击分区横条"全部"跳 `/partitions` 正常
4. 消息 → 进入消息页，角标显示正确
5. 发帖 → 点击"+"跳 `/post` 正常
6. 工作台 → 6 个常用入口 + 10 个分区入口均可点击
7. 工作台 → iWiki 在新标签打开外链
8. 我的 → 下拉菜单 5 项（个人信息/我的收藏/发帖历史/反馈/前往wiki）均可点击
9. MobileHeader 左侧小秋图标点击跳转 `/smart-xiaoqiu`
10. MobileHeader 搜索框与发帖按钮功能正常

- [ ] **Step 2: PC 端回归验证（>768px）**

浏览器拉宽到 ≥769px，预期：

- 顶部 PcHeader 一行图标链接布局完全不变
- 底部导航不显示（PC 端原本就不显示 BottomNavbar）
- 各 PC 端入口（发帖/分区/课程专区/反馈/商城/打分/智能小秋/收藏/历史/消息/用户名）均可正常点击

- [ ] **Step 3: 深色模式验证**

切换深色模式，预期：

- 底部导航"+"按钮背景色与边框圈颜色正确
- 工作台所有 16 个格子图标颜色正确
- MobileHeader 小秋图标颜色变浅紫色
- "我的"下拉菜单颜色正确

- [ ] **Step 4: 最终类型检查与构建**

Run: `pnpm type-check`
Expected: PASS，无新增类型错误

Run: `pnpm build`
Expected: 构建成功，无报错

- [ ] **Step 5: 总结 Commit（可选，如有零散改动）**

如前面任务都已 commit，此步可跳过。否则：

```bash
git add -A
git commit -m "test: e2e verification for mobile workbench nav"
```

---

## Self-Review

### 1. Spec coverage

- ✅ 底部导航 5 项（主页/消息/+发帖/工作台/我的）→ Task 3-5
- ✅ 中间凸起"+发帖"按钮 → Task 5 Step 3
- ✅ 工作台 4 列宫格，常用组 6 项（4+2 换行）→ Task 2
- ✅ 工作台全部分区组 10 项（4+4+2 换行）→ Task 2
- ✅ iWiki 在工作台，新窗口打开外链 → Task 2
- ✅ 课程专区在工作台常用组，跳 `/course` → Task 2
- ✅ MobileHeader 左侧课程图标替换为小秋 → Task 6
- ✅ "我的"下拉菜单不变 → Task 3-5 保留原结构
- ✅ 主页分区横条不动 → 计划未触碰 `PartitionList.vue`
- ✅ PC 端不动 → 计划未触碰 `PcHeader.vue`/`PwaPcHeader.vue`

### 2. Placeholder scan

- 无 TBD/TODO
- 所有代码块均为完整可执行内容
- 所有命令均带 expected 输出

### 3. Type consistency

- `CommonEntry` 接口在 Task 2 定义，`commonEntries` 使用一致
- `isWorkbench`/`isPost` 在 Task 3 定义，Task 4 template 引用名称一致
- `bottom-nav__item--post`/`bottom-nav__post-btn`/`bottom-nav__icon--workbench` 类名在 Task 4-5 间一致
- `lesson--xiaoqiu` 类名在 Task 6 内部一致
