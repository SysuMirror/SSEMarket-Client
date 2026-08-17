# 移动端底部导航重构 + 工作台页面 设计文档

- **日期**: 2026-08-15
- **范围**: `sse_market_new_client/newSSE`（仅移动端 ≤768px）
- **状态**: 待用户审阅

## 1. 背景与目标

### 1.1 当前状况

移动端底部导航为 6 项：主页 / 消息 / 排行榜 / 小秋 / 简历 / 我的(下拉)。在窄屏（如 iPhone SE）上图标拥挤、文字截断，与企业微信风格差距明显。

### 1.2 目标

参考企业微信，将底部导航压缩为 5 项，中间放凸起的"+ 发帖"按钮；将排行榜、小秋、简历、商城、所有专区以及 iWiki 统一收纳到新建的"工作台"页面。

## 2. 范围与非目标

### 2.1 范围

- 新建工作台视图 `src/views/WorkbenchView.vue` 与路由 `/workbench`
- 改造 `src/components/BottomNavbar.vue`（仅移动端布局，PC 端分支不动）
- 移除底部导航的"排行榜/小秋/简历"三项

### 2.2 非目标（明确不动）

- PC 端顶部 `PcHeader.vue` / `PwaPcHeader.vue` 不动
- 移动端 `MobileHeader.vue` 的搜索框与右侧发帖按钮不动；仅替换左侧入口图标（详见 3.5）
- 主页顶部分区横条 `src/components/PartitionList.vue` 保留不动
- "我的"下拉菜单结构不变（个人信息/我的收藏/发帖历史/反馈/前往wiki）
- 消息角标逻辑不变
- 深色模式 token 体系沿用现有 `--chat-*` 变量

## 3. 设计详情

### 3.1 底部导航新结构（移动端 ≤768px）

| 位置 | 1    | 2           | 3(中间)    | 4                 | 5          |
| ---- | ---- | ----------- | ---------- | ----------------- | ---------- |
| 入口 | 主页 | 消息        | **+ 发帖** | 工作台            | 我的(下拉) |
| 路由 | `/`  | `/messages` | `/post`    | `/workbench` ⭐新 | (下拉不变) |

#### 3.1.1 中间"+ 发帖"按钮样式

- 圆形凸起按钮，垂直突出于底部导航条上方约 6-8px
- 复用现有图片资源 `https://ssemarket.cn/new/webp/sendPostButton.webp` 作为按钮视觉内容
- 直径约 44px，背景使用 `--chat-accent` 或品牌色，确保深色模式下可见
- 不引入新依赖、不新增图片资源

#### 3.1.2 移除项去向

- 排行榜 → 工作台常用组第 1 格
- 小秋 → 工作台常用组第 2 格
- 简历 → 工作台常用组第 3 格
- 商城 → 工作台常用组第 4 格（原底部导航无此项，但移动端有入口需求）

### 3.2 工作台页面 `WorkbenchView.vue`

#### 3.2.1 路由

```ts
// src/router/index.ts，DefaultLayout children 内新增
{
  path: 'workbench',
  name: 'Workbench',
  component: () => import('@/views/WorkbenchView.vue'),
}
```

#### 3.2.2 页面布局（4 列宫格，允许换行）

```
┌─────────────────────────────────────┐
│  工作台                              │
├─────────────────────────────────────┤
│  常用                                │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐        │
│  │排行│ │小秋│ │简历│ │商城│        │  ← 4 列，第 1 行
│  └────┘ └────┘ └────┘ └────┘        │
│  ┌────┐ ┌────┐                      │
│  │iWiki│ │课程│                     │  ← 第 2 行（2 格，自然换行）
│  └────┘ └────┘                      │
├─────────────────────────────────────┤
│  全部分区                            │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐        │
│  │学习│ │生活│ │社团│ │实习│        │  ← 4 列，第 1 行
│  └────┘ └────┘ └────┘ └────┘        │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐        │
│  │资料│ │宿舍│ │技术│ │课程专区│    │  ← 第 2 行
│  └────┘ └────┘ └────┘ └────┘        │
│  ┌────┐ ┌────┐                      │
│  │组团│ │其他│                      │  ← 第 3 行（2 格，自然换行）
│  └────┘ └────┘                      │
└─────────────────────────────────────┘
```

- **常用组**：6 个入口，使用 CSS Grid `grid-template-columns: repeat(4, minmax(0, 1fr))`，第 5、6 个(iWiki/课程专区)自然换行到第 2 行
- **全部分区组**：10 个分区，4 列网格自然换行（4+4+2），复用 `CONTENT_PARTITIONS` 常量渲染
- 注意：`CONTENT_PARTITIONS` 中含"课程专区"项（key: `course`），与常用组的"课程专区"在视觉上重复，但跳转目标不同——常用组跳 `/course`（CourseView，与原 MobileHeader 一致），全部分区组跳 `/partition/课程专区`（PartitionView）。本次不解决该历史不一致，仅按原行为保留

#### 3.2.3 入口定义

**常用组**（硬编码 6 项）：

| 入口     | 跳转                                             | 图标                  |
| -------- | ------------------------------------------------ | --------------------- |
| 排行榜   | `/ranking`                                       | `tabler:trophy`       |
| 小秋     | `/smart-xiaoqiu`                                 | `tabler:sparkles`     |
| 简历     | `/resume`                                        | `tabler:file-cv`      |
| 商城     | `/shop`                                          | `tabler:shopping-bag` |
| iWiki    | 外链 `https://ssemarket.cn/iwiki/`（新窗口打开） | `tabler:book-2`       |
| 课程专区 | `/course`                                        | `tabler:book`         |

**全部分区组**：直接复用 `CONTENT_PARTITIONS` 数组渲染，每格点击跳转 `/partition/{encodeURIComponent(name)}`。

#### 3.2.4 视觉规范

- 卡片样式与 `PartitionListView.vue` 保持一致（圆角 12px、边框、悬停效果）
- 图标语义色复用现有 token：排行榜 `#eab308`、小秋 `#7c3aed`、简历 `#0d9488`、商城 `#059669`、iWiki 使用 `#6366f1`（与分区条"全部"入口同色）
- 深色模式色值复用 `body.dark-mode` 现有覆写规则
- 间距：组与组之间 16px，卡片之间 8px gap
- 卡片大小：aspect-ratio 约 1:1 或 5:4，确保图标+文字垂直居中

### 3.3 BottomNavbar 改动详情

#### 3.3.1 script 部分

- 移除 `isRanking`、`isSmartXiaoQiu`、`isResume` 三个 computed
- 新增 `isWorkbench` computed：`path.value === '/workbench'`
- `isMySection` 数组保持不变

#### 3.3.2 template 部分

新模板顺序（移除 3 个 RouterLink，新增 2 个）：

1. 主页（不变）
2. 消息（不变）
3. **新增**：发帖 RouterLink，`to="/post"`，class 含 `bottom-nav__item--post`，内部为凸起圆形按钮
4. **新增**：工作台 RouterLink，`to="/workbench"`，icon `tabler:grid-dots`
5. 我的（不变）

#### 3.3.3 style 部分

- 新增 `.bottom-nav__item--post` 样式：圆形凸起按钮，margin-top 负值使其突出
- 移除 `.bottom-nav__icon--ranking/--xiaoqiu/--resume` 三组色值（不再被引用）
- 新增 `.bottom-nav__icon--workbench` 色值 `#6366f1`（亮色）/ `#a5b4fc`（深色）
- 中间按钮的图片背景复用 `sendPostButton.webp`

### 3.4 主布局 `DefaultLayout.vue` 影响

- 无需改动：BottomNavbar 仍是异步组件，主区域 padding-bottom 仍按 `--layout-bottom-nav-h` 计算
- 工作台路由属于 DefaultLayout children，自动继承顶栏+底部导航

### 3.5 MobileHeader 左侧入口替换

`src/components/MobileHeader.vue` 当前左侧为课程图标链接（指向 `/course`）。本次将其替换为"小秋"入口：

- 原：`<RouterLink to="/course" class="lesson" ...>`，背景图来自 icons8
- 新：`<RouterLink to="/smart-xiaoqiu" class="lesson" ...>`，使用 `@iconify/vue` 的 `tabler:sparkles` 图标替代 icons8 外链图片
- 复用现有 `.lesson` CSS 类（尺寸 26×26、深色模式滤镜），仅替换内容
- 搜索框与右侧发帖按钮不动
- 课程专区入口迁移到工作台常用组（跳转 `/course`，行为与原 MobileHeader 一致）

## 4. 数据流与状态

- 工作台页面是纯静态入口页，无自身状态
- 不影响 `useChat`、`useNoticeStore`、`useNewPostsStore` 等现有 store
- 路由跳转使用标准 `RouterLink`，无需新增 composable

## 5. 错误处理

- 工作台路由无需鉴权（沿用 DefaultLayout 的全局 beforeEach）
- iWiki 外链使用 `<a target="_blank" rel="noopener noreferrer">`，避免 tabnabbing

## 6. 测试策略

1. **手动验证**（Vite dev server，浏览器响应式模式）
   - iPhone SE (375px)：底部 5 项不挤、"+"按钮凸起、文字不截断
   - iPad (768px)：切换到 PC 布局，确认 PC 端 PcHeader 不受影响
   - 深色模式：所有新元素颜色正确
2. **功能验证**
   - 5 个底部入口均可点击跳转
   - 工作台 5 个常用入口 + 10 个分区入口均可点击
   - "我的"下拉菜单 5 项功能保持原状
   - 主页分区横条仍正常显示
3. **构建验证**
   - `pnpm dev` 无报错
   - `pnpm type-check`（vue-tsc）无新增类型错误

## 7. 影响文件清单

| 文件                               | 改动类型 | 说明                                              |
| ---------------------------------- | -------- | ------------------------------------------------- |
| `src/views/WorkbenchView.vue`      | 新建     | 工作台页面                                        |
| `src/router/index.ts`              | 修改     | 加 1 条 `/workbench` 路由                         |
| `src/components/BottomNavbar.vue`  | 修改     | 替换 3 项为"+发帖/工作台"                         |
| `src/components/MobileHeader.vue`  | 修改     | 左侧课程图标替换为小秋入口（搜索框/发帖按钮不动） |
| `src/assets/main.css`              | 可能修改 | 如需补充底部"+"凸起按钮全局样式                   |
| `src/components/PcHeader.vue`      | 不动     | —                                                 |
| `src/components/PwaPcHeader.vue`   | 不动     | —                                                 |
| `src/components/PartitionList.vue` | 不动     | —                                                 |
| `src/layouts/DefaultLayout.vue`    | 不动     | —                                                 |

## 8. 验收标准

- [ ] 移动端（≤768px）底部导航显示 5 个入口：主页 / 消息 / +发帖(凸起) / 工作台 / 我的
- [ ] 中间"+"按钮为圆形凸起，点击跳转 `/post`
- [ ] 工作台页面常用组 6 格（4+2 换行：排行榜/小秋/简历/商城 + iWiki/课程专区）、全部分区组 10 格（4+4+2 换行）
- [ ] 工作台所有 16 个入口均可点击跳转（iWiki 新窗口打开外链，其余 15 个为站内路由）
- [ ] MobileHeader 左侧图标已替换为小秋入口，点击跳转 `/smart-xiaoqiu`
- [ ] MobileHeader 搜索框与右侧发帖按钮功能不变
- [ ] "我的"下拉菜单 5 项功能保持原状
- [ ] 主页分区横条仍正常显示
- [ ] PC 端（>768px）布局完全不变
- [ ] 深色模式下所有新元素颜色正确
- [ ] `pnpm dev` 无报错，`pnpm type-check` 无新增类型错误

## 9. 风险与回滚

- **风险低**：仅移动端布局调整，PC 端无影响
- **回滚**：删除 `WorkbenchView.vue`、还原 `BottomNavbar.vue`、`MobileHeader.vue` 与 `router/index.ts` 即可
