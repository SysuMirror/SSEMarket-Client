# newSSE — SSE Market 主站前端

软工集市（[ssemarket.cn](https://ssemarket.cn/new/)）主站 SPA：帖子、分区、商城、音乐、私信、AI 解读等。

## 技术栈

Vue 3.5 + TypeScript + Vite 6 + UnoCSS + vue-router 4（history 模式）。
音乐播放 Howler.js（html5 流式，支持 Range 拖动）；富文本为 markdown-it 渲染。

## 分支说明

| 分支 | 用途 |
|---|---|
| `hotfix/login-button-20260826` | **当前生产分支**，线上 dist 由它构建 |
| `master` | 历史默认分支，落后于生产分支，待合并对齐 |
| `dev-*` / `draft` / `test` 等 | 历史功能分支 |

> 克隆后请先确认分支：`git checkout hotfix/login-button-20260826`

## 本地开发

```bash
pnpm install
pnpm dev          # 默认直连生产 API（见 .env.development）
pnpm type-check   # vue-tsc
pnpm lint         # eslint --fix
```

## 环境变量

| 变量 | dev 默认 | build 默认 | 说明 |
|---|---|---|---|
| `VITE_API_BASE_URL` | `https://ssemarket.cn/api` | `/api` | 后端地址；构建用相对路径同源直连 |
| `VITE_OPSAGENT_BASE_URL` | `https://ssemarket.cn` | 空 | 运维代理 |
| `VITE_ASSIST_ENABLED` | `true` | `true` | 发帖 AI 应答灰度开关（白名单见 `src/config/assist.ts`） |

## 构建与部署

```bash
pnpm build        # vue-tsc + vite build，产物在 dist/
```

生产构建在**服务器上的仓库内执行**（`/root/SSE_Market/sse_market_new_client/newSSE`），dist 由 nginx 容器直接 bind-mount 对外服务，构建完成即生效。请勿从本地旧克隆构建上传——以服务器工作树为准确认过改动再动手。

后端仓库：[qvq-qiu/SSE_market_server](https://gitee.com/qvq-qiu/SSE_market_server)（Go + Gin + MySQL）。

## 目录速览

```
src/
  api/          各域接口封装（requestFunc 统一带 token）
  components/   业务组件（music/ 为音乐播放全家桶）
  composables/  组合式逻辑
  config/       灰度等配置
  layouts/      布局（Default/Auth/Shop）
  router/       路由
  store/        状态（userStore/musicStore/noticeStore）
  views/        页面
```

## 帖子内嵌音乐约定

正文里独占一行的 `::music <id>::` 会渲染为可点播卡片（`MarkdownContainer.vue` 预处理 + 水合）；发帖编辑器工具栏「插入音乐」自动生成。
