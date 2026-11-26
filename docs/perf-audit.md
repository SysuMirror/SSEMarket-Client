# 首页 / 帖子详情页首屏性能与图片加载策略审计

> 需求单：**SK-3993C864**（缺陷 / 平台 market-client / normal）
> 工作分支：`fix/yz-sk-3993c864`
> 审计日期：2026-11-23
> 审计性质：**只读审计**，未修改任何业务代码。
> 审计方式：逐文件静态阅读 + 行号引用。审计环境没有 `node_modules`，也没有 `pnpm`，因此**未执行构建、Lighthouse 或真机测量**；文中所有体积/耗时结论均为源码推断，需按 §5 复测确认。
> 引用格式：`文件:行号`，行号以本次审计时的分支代码为准。

---

## 0. 结论速览（Top 5）

| # | 问题 | 关键位置 | 主要影响 | 建议优先级 |
|---|------|----------|----------|------------|
| 1 | 整个路由视图被 SSO 探测 + 皮肤接口门控，首屏白屏等待 | `src/App.vue:63-132`、`src/api/sso/sso.ts:61-124` | FCP/LCP 直接增加约 0.9s～6s，极端情况更久 | **P0** |
| 2 | 首页请求串行且重复：计数 → 列表 → 两次「新帖探测」 | `src/composables/usePostView.ts:26-37`、`src/views/HomeView.vue:124-131`、`src/store/newPostsStore.ts:41-55,73` | 首屏多出 2～3 个往返、空白期无骨架、服务端压力翻倍 | **P0** |
| 3 | 信息流/头像/旧版图集原图直出，只有详情正文做了缩放；首屏大图又被 `loading="lazy"` 推迟 | `src/components/card/PostCard.vue:40-56,271-279`、`src/components/UserAvatar.vue:116-122`、`src/components/MarkdownContainer.vue:122-150` | LCP 图片体积可达数 MB，移动端流量/解码/内存显著浪费 | **P0** |
| 4 | 入口包与阻塞 CSS 过重：9 个全局样式 + 静态音乐/皮肤浮层（Howler 进入口）+ `vendor` 单 chunk + Iconify 运行时拉图标 | `src/main.ts:7-16`、`src/App.vue:13-20`、`src/store/musicStore.ts:2`、`vite.config.ts:44-71`、`package.json:38` | 首屏 JS/CSS 下载与解析变慢，弱网下明显 | **P1** |
| 5 | 详情页 Markdown / 评论主线程开销：Prism 重复高亮 + cdnjs 运行时加载语法 + ViewerJS 静态引入 + 全量评论渲染 | `src/components/MarkdownContainer.vue:17,62,204,254-256,419-427`、`src/views/PostDetailView.vue:145-154,266-273` | 正文渲染长任务、评论多时掉帧，代码块/图片功能首屏即付费 | **P1** |

---

## 1. 审计范围与判定口径

- **页面**：首页 `HomeView`（路由 `/`）与帖子详情页 `PostDetailView`（`/postdetail/:id`），并覆盖两者共用的布局、列表卡片、Markdown 与图片组件。
- **首屏**：移动端 4G 冷缓存下，第一次可见内容（FCP）与最大内容元素（LCP）出现前的链路。
- **关注项**：
  1. 组件加载顺序与代码分包；
  2. 阻塞渲染的资源（CSS、字体、第三方 API、门控请求）；
  3. 接口串行/并行与重复请求；
  4. 列表懒加载、分页、缓存与虚拟化；
  5. 图片懒加载、占位、尺寸、格式、CDN/缓存头、上传压缩。
- **不在本次范围**：后端实现细节、线上 Nginx/网关配置、具体业务逻辑正确性。

---

## 2. 首屏渲染性能

### 2.0 当前启动/首屏链路（按代码顺序）

```
main.ts
  ├─ 同步导入 9 个全局 CSS + UnoCSS          (src/main.ts:7-16)  ← 入口 CSS，渲染阻塞
  ├─ initSkin()（读 localStorage）            (src/main.ts:24)
  └─ app.mount('#app')                        (src/main.ts:29)
       └─ App.vue setup：静态导入音乐/皮肤浮层等 (src/App.vue:13-20)
            └─ onBeforeMount
                 ├─ await ssoTry()            (src/App.vue:72)   ← 最多等 6s（见 sso.ts:61）
                 ├─ 登录成功时 await getInfo() (src/App.vue:76)   ← 无显式超时
                 └─ await race(refreshThemeState(), 900ms)        (src/App.vue:115-118)
                      └─ isUserReady = true   (src/App.vue:119)
                           └─ <router-view v-if="isUserReady">    (src/App.vue:132) ← 此前整页空白
                                └─ DefaultLayout onMounted
                                     ├─ connect() / presence / 通知数 / 推荐设置 (src/layouts/DefaultLayout.vue:121-142)
                                     ├─ startPolling() → checkNewPosts() 立即请求一次 (src/layouts/DefaultLayout.vue:142, src/store/newPostsStore.ts:73)
                                     └─ HomeView onMounted
                                          ├─ await initialize('主页')
                                          │    ├─ await updateNum()   ← 请求 1（计数）
                                          │    └─ await update()      ← 请求 2（列表）
                                          └─ await initNewPostsCache() ← 请求 3（limit 20）
```

这条链路上，**路由内容在 `isUserReady` 之前完全不渲染**，且首页首屏至少串行 3 个请求。

---

### 2.1 【P0】首屏被 SSO 探测与皮肤接口门控

**现状**

- `src/App.vue:132`：`<router-view v-if="isUserReady" />`，`isUserReady` 在 `onBeforeMount` 末尾才置真（`src/App.vue:119`）。
- `src/App.vue:72`：无条件 `await ssoTry()`；`ssoTry` 的 UI 等待上界为 6s（`src/api/sso/sso.ts:61`），真实请求超时 15s（`src/api/sso/sso.ts:63,76,117-124`）。
- `src/App.vue:76`：SSO 成功后 `await getInfo()`，`requestFunc` 的 `fetch` 没有超时/AbortController（`src/api/req.ts` 内 `fetch` 调用），若该请求悬挂，`isUserReady` 永远不会置真。
- `src/App.vue:115-118`：即使 SSO 快速结束，还要 `await Promise.race([refreshThemeState(), 900ms])`；`fetchThemeState` 本身使用 `cache: 'no-store'`（`src/api/theme/theme.ts:125-129`），每次进站都要回源。
- 路由守卫里还有一层同源等待：未登录且无 refresh token 时，`Promise.race([ssoTry(), 1500ms])`（`src/router/index.ts:348-369`）。它与 App 共用 `probePromise`，不会重复发网络请求，但会额外阻塞初始导航最多 1.5s。

**问题与影响**

- 最坏情况下首屏白屏 = `min(sso 6s, 网络)` + `getInfo`（无上限）+ 0.9s 皮肤等待；正常慢网也能稳定感知到 1～2s 的纯空白。
- 皮肤/登录是「装饰/身份」信息，不应该成为内容渲染的前置条件。当前顺序把非关键请求放在了 LCP 关键路径上。
- 首屏没有 HTML 级静态骨架或品牌占位，`#app` 为空直到 `isUserReady`，FCP 也被一并推迟。

**建议（收益高 / 成本中）**

1. **立即渲染路由**：去掉 `router-view` 上的 `v-if`，把 `isUserReady` 仅用于「皮肤开场/弹窗」这类覆盖层；布局和首页先渲染骨架或默认主题。
2. **SSO/用户信息后台化**：`ssoTry()`、`getInfo()` 改为 `void` 后台执行，结果回来后更新 store；路由守卫在「本地已有 token」时直接放行，不再等待探测。
3. **皮肤先本地后远端**：`initSkin()` 已经同步应用本地缓存（`src/main.ts:24`），允许服务端设置稍后覆盖；删除 `router-view` 的 900ms 门控，仅对「活动开场画面」做独立覆盖。
4. **补超时**：`getInfo` 与 `fetchThemeState` 加 `AbortSignal.timeout(...)`（如 3s），失败即按本地缓存继续。

---

### 2.2 【P1】入口 JS / CSS 过重，首屏为大量非首屏功能付费

**现状**

- 入口同步导入 9 个全局样式 + UnoCSS（`src/main.ts:7-16`）。其中与首页无关或弱相关的大文件：

  | 文件 | 体积（源码） | 主要服务页面 |
  |---|---:|---|
  | `src/assets/comment-ui.scss` | 18.3 KB | 评论区 |
  | `src/assets/shop-zone.scss` | 9.6 KB | 商城 |
  | `src/assets/mode.css` | 8.1 KB | 主题 |
  | `src/assets/skin-base.css` | 8.0 KB | 皮肤 |
  | `src/assets/main.css` | 5.0 KB | 全局 |
  | `src/assets/skin-programmers-day-2026.css` | 3.8 KB | 活动皮肤 |
  | `src/assets/post-feed.scss` | 1.3 KB | 信息流 |
  | `src/assets/rating-hupu.scss` | 1.0 KB | 打分区 |

  合计约 55 KB 未压缩；作为入口 CSS，它们会进入首屏 `<link rel=stylesheet>`，阻塞首次绘制。
- `src/App.vue:13-20` 静态导入 `TitleCustomizeModal`、`PlayerBar`、`NowPlayingOverlay`、`PlaylistDrawer`、`FestivalSplash`、`SkinShareAddDialog`。其中 `PlayerBar` → `src/store/musicStore.ts:2` 静态 `import { Howl } from 'howler'`，**Howler 被带进入口依赖图**；其余浮层/弹窗首屏大多不展示（`v-if`/按需）。
- `src/components/card/PostCard.vue:19` 静态导入 `CoinThrowButton`；`src/components/CoinThrowButton.vue:7` 又静态导入 `CoinThrowDialog`；`src/components/CoinThrowDialog.vue:5-8` 引入 `coin-dialog-pet.png`（1.1 MB）、`coin-icon.png`（约 200 KB）、两张 `coin-mascot`（约 176 KB/张）。图片本身不会立即下载（弹窗 `v-if`），但弹窗组件与资源清单进入信息流依赖图，且无独立异步 chunk。
- `vite.config.ts:44-71` 的 `manualChunks` 只有 `vue` / `markdown` / `prismjs` / `cryptoJs` / `pdfjs`，其余全部落到单个 `vendor`。这会把「仅详情页懒加载才用」的库（如 `viewerjs`）与入口必用库打进同一 vendor chunk，入口很容易被迫下载整个大 vendor。
- `index.html:1-23` 没有任何 `preconnect` / `preload`；仓库仅有构建期 DNS 预解析插件（`plugins/vite-plugin-dns-prefetch.ts:55-78`），上限 5 个域名，且只生成 `dns-prefetch`，不建立 TLS 连接。

**问题与影响**

- 入口 CSS + JS 体积直接对应弱网下的下载/解析时间；首页并不需要商城、打分区、活动皮肤的全部样式。
- Howler、ViewerJS、各类浮层混进入口或同一 vendor，会让首页 TTI/TBT 变差。
- 缺少 `preconnect`，图床域名要等首张图片请求才开始 DNS + TCP + TLS，放大 LCP。

**建议（收益高 / 成本中）**

1. 将 `PlayerBar`、`NowPlayingOverlay`、`PlaylistDrawer`、`FestivalSplash`、`SkinShareAddDialog`、`TitleCustomizeModal` 改为 `defineAsyncComponent`；Howler 在真正播放时再动态 `import('howler')`。
2. `CoinThrowButton` 中的 `CoinThrowDialog` 改 `defineAsyncComponent`，让 1.1 MB 宠物图及其组件只在点击投币时进入网络。
3. 全局 CSS 按路由拆分：`comment-ui` 跟随评论组件、`shop-zone` 跟随 `ShopLayout`、`rating-hupu` 跟随打分区；保留 `main/mode/skin-base/uno` 为入口。
4. `manualChunks` 按库拆分（至少把 `viewerjs`、`howler`、`crypto-js`、`@iconify/vue` 独立），或对纯懒加载依赖使用动态 import，让 Rollup 自然分块。
5. `index.html` 增加 `<link rel="preconnect" href="https://image.ssemarket.cn" crossorigin>`；如线上图标仍走 Iconify API，再加对应域名。

---

### 2.3 【P1】Iconify 图标在运行时向第三方 API 拉取

**现状**

- `package.json:38` 只有 `@iconify/vue`，**没有** 任何 `@iconify-json/*` 图标集依赖；全仓库搜索 `@iconify-json` 无结果，`vite.config.ts` 也没有图标离线加载插件或 `addCollection` / `setCustomIconLoader` 配置。
- 55 个文件从 `@iconify/vue` 引入 `Icon`，首页/详情首屏直接使用，例如：
  - 首页排序与徽标：`src/views/HomeView.vue:5,192,212-214,228`；
  - 信息流卡片：`src/components/card/PostCard.vue:3,260,299`；
  - 用户身份/操作按钮：`src/components/UserIdentityIcon.vue:2,22`、`src/components/UserButton.vue:2`。

**问题与影响**

- `@iconify/vue` 的 `<Icon>` 在本地没有图标数据时，会按图标集向 Iconify 公共 API 请求 JSON。首屏的 `tabler:*` 图标因此需要额外的第三方 DNS/TLS/请求，图标会「先空白后出现」，并给 LCP/视觉稳定性带来抖动。
- 第三方 API 在弱网/跨境链路上的可用性不可控，且与站点自身域名无关。

**建议（收益高 / 成本低～中）**

1. 构建期离线化：安装 `@iconify-json/tabler`，用 `addCollection` 注册，或引入 `unplugin-icons` 把图标编译成内联 SVG/组件。
2. 若只使用少量图标，直接改为内联 SVG 组件，彻底去掉运行时请求。
3. 验证方法：DevTools Network 过滤 `api.iconify.design`；修复后该域名请求应为 0。

---

### 2.4 【P0】首页数据请求串行 + 重复请求

**现状**

1. `src/composables/usePostView.ts:26-37`：

   ```ts
   await updateNum(userInfo.phone)  // POST /auth/getPostNum
   await update()                   // POST /auth/browse
   ```

   两个请求严格串行；而 `/auth/browse` 的响应里已经带 `total`（`src/api/browse/getPost.ts:59,94-97`），`addPost` 却没有消费它（`src/store/postStore.ts:67-82`），导致计数请求在首页场景是冗余的。
2. 首页挂载后立刻又拉一次新帖基准：`src/views/HomeView.vue:124-131` 的 `await initNewPostsCache()`；`src/store/newPostsStore.ts:41-55` 用 `getPosts({ limit: 20, offset: 0 ... })` 取完整帖子对象，只为了拿 20 个 `PostID`。
3. 布局层同时启动轮询：`src/layouts/DefaultLayout.vue:142` `startPolling()`，其内部立即调用 `checkNewPosts()`（`src/store/newPostsStore.ts:73`），又会走一次同样的 `limit: 20` 请求。于是首屏最多出现：
   - `/auth/getPostNum`（计数）
   - `/auth/browse`（首屏 15 条）
   - `/auth/browse?limit=20`（HomeView 初始化新帖缓存）
   - `/auth/browse?limit=20`（DefaultLayout 轮询首次检查）
4. 轮询每 60s 重复拉 20 条完整帖子（`src/store/newPostsStore.ts:112-114`），只比较 ID；即使页面在后台标签页也不暂停。
5. `initialize` 中 `refreshPosts()` 先清空列表，而 `isLoading` 直到 `update()` 才置真（`src/composables/usePostView.ts:12-23`）。在 `updateNum` 这一整个往返期间，列表为空且骨架条件 `isLoading && !posts.length` 不成立（`src/components/PostList.vue:64`），**用户看到的是工具栏下的空白区域**。

**问题与影响**

- 首屏多 2～3 个 RTT，移动网络下每 RTT 100～300ms，直接拖慢内容出现。
- 20 条列表响应包含 `Content` 全文与 `HotComment`（类型见 `src/types/post.d.ts:1-30`），而调用方只需要 ID，属于明显的流量浪费。
- 计数与列表可并行/合并，却串行；空白期没有骨架，FCP 观感变差。
- 重复请求与 60s 全量轮询增加服务端与图床无关但真实的 DB/带宽压力。

**建议（收益高 / 成本低）**

1. 首屏直接用 `/auth/browse` 的 `total` 更新 `totalNum`，删除 `initialize` 里的 `await updateNum()`；至少改为 `Promise.all`。
2. `initNewPostsCache` 与 `startPolling` 的首次检查合并：抽一个「获取首页最新 ID 列表」的单飞（in-flight promise + 短 TTL），同一时刻只发一个请求。
3. 后端增加轻量接口（如 `GET /auth/newPosts?since=<lastId>&limit=50` 或返回 `latestPostID/total`），前端只比对 ID；在接口就绪前，前端可先用 `limit: 1` + `total` 判断是否有新帖。
4. `initialize` 一开始就置 `isLoading = true`（或保留旧列表直到新数据到达），保证骨架/旧内容立即出现。
5. 轮询加 `document.visibilityState` 判断与错误退避（如 60s → 5min），页面隐藏时暂停。

---

### 2.5 【P1】详情页请求串行

**现状**

- `src/views/PostDetailView.vue:191-214`：

  ```ts
  const curPost = await getPostByID(ID, userInfo.phone)
  post.value = curPost
  void resolveAssistForPost(post.value) // 并行（好）
  void refreshDigestPref()              // 并行（好）
  void loadStaffAliases()               // 并行（好）
  await getCommentList()                // 等帖子完成后才开始
  await loadLottery()                   // 再等评论完成后才开始
  postLoaded.value = true
  ```

- 评论接口只依赖 `route.params.id` 与用户手机号（`src/views/PostDetailView.vue:145-154`），并不依赖帖子详情；却要等帖子返回后才发。
- 抽奖接口依赖 `post.IsLottery`（`src/views/PostDetailView.vue:136-143`），需要等帖子，但可以和评论并行。

**问题与影响**

- 评论与抽奖各增加一个串行 RTT；评论越多、帖子越晚出现，二次内容（评论区）出现越慢。
- `postLoaded` 直到全部完成才置真（`src/views/PostDetailView.vue:213`），虽然正文已可渲染，但后续逻辑被整体拉长。

**建议（收益中 / 成本低）**

1. 评论请求与帖子请求并行：`const commentsP = getCommentList()` 放在 `getPostByID` 之前；拿到帖子后再 `Promise.allSettled([commentsP, loadLottery()])`。
2. 抽奖与评论并行；`resolveAssistForPost` / digest / staff 已在并行，保持。
3. 评论区域可以先渲染骨架（`PageSkeleton variant="list"`），不必等评论完成才展示面板。
4. 对详情路由做「意图预取」：卡片链接 hover/进入视口时 `import('@/views/PostDetailView.vue')`，缩短路由 chunk 下载时间。

---

### 2.6 【P1】Markdown 渲染的主线程与重复工作

**现状**

- `src/components/MarkdownContainer.vue:17` 引入 Prism autoloader；`:62` 把语法文件路径指向 `https://cdnjs.cloudflare.com/...`。代码块首次高亮时会按语言从第三方 CDN 拉取语法 JS。
- 同一份内容被高亮两次：
  - `safeHTML` computed 内 `nextTick(() => Prism.highlightAllUnder(content.value!))`（`src/components/MarkdownContainer.vue:254-256`）；
  - `watch(safeHTML, ..., { immediate: true })` 内又执行一次 `Prism.highlightAllUnder`（`src/components/MarkdownContainer.vue:419-427`）。
- `DOMPurify.addHook('uponSanitizeElement', ...)` 写在 computed 内部（`src/components/MarkdownContainer.vue:204-208`），每次重算都会重复注册 hook，钩子数量随渲染次数增长。
- `useMentionResolve` 对内容做深监听（`src/components/MarkdownContainer.vue:35-39`），提及变化会触发整段 Markdown 重新渲染与净化（`src/components/MarkdownContainer.vue:193-259`）。
- `Viewer` 与 `viewerjs/dist/viewer.css` 在详情页静态引入（`src/components/MarkdownContainer.vue:6,20`），但只有用户点击图片时才需要。
- 详情页评论一次性全量渲染：`getCommentsByPostID` 无分页参数（`src/api/browse/getComment.ts:4-26`），模板对所有评论 `v-for` 渲染 `CommentCard`（`src/views/PostDetailView.vue:266-273`），每条评论内部还会挂载异步子组件（`src/components/card/CommentCard.vue:33-36`、`src/components/card/CCommentCard.vue:31-34`）。

**问题与影响**

- 长文/多代码块帖子的 Markdown 渲染会形成明显长任务；双重高亮使成本翻倍。
- cdnjs 运行时请求在弱网下可能长时间不返回，代码块长时间无高亮甚至触发重复请求。
- 评论数百条时，首屏会创建大量 DOM 与组件实例，滚动/输入明显掉帧，移动端内存上涨。

**建议（收益中高 / 成本中）**

1. 删除一处 `Prism.highlightAllUnder`，只保留一个调度点；把 `DOMPurify.addHook` 移到模块初始化（只注册一次）。
2. 去掉 autoloader 或改为仅打包项目常用的语言（`javascript/typescript/json/bash/python/go/...`），避免运行时访问 cdnjs。
3. `Viewer` 改为点击时动态 `import('viewerjs')`，CSS 同步按需加载。
4. 评论分页「加载更多」或虚拟列表；默认只渲染前 N 条一级评论，展开后再加载子评论。
5. 大正文可考虑 `requestIdleCallback` 或 Web Worker 做 Markdown 渲染/净化，至少把高亮延后到首屏稳定后。

---

### 2.7 【P2】列表分页、缓存与虚拟化

**现状（做得好的部分）**

- 路由级懒加载：所有页面均 `() => import(...)`（`src/router/index.ts:13-310`）。
- 布局头部/导航异步化：`BottomNavbar`、`PcHeader`、`PwaPcHeader`、`PartitionList`、`MobileHeader` 均为 `defineAsyncComponent`（`src/layouts/DefaultLayout.vue:25-36`）。
- 首页 KeepAlive + 滚动恢复：`src/layouts/DefaultLayout.vue:220-223`、`src/views/HomeView.vue:133-156`。
- 触底分页使用 IntersectionObserver，`rootMargin: 240px` 提前预取（`src/components/PostList.vue:21-37`）。
- 首屏骨架：`src/components/PageSkeleton.vue`，列表 `src/components/PostList.vue:64`，详情 `src/views/PostDetailView.vue:223`。

**仍存在的问题**

- 已加载帖子只增不减（`src/store/postStore.ts:80` `posts.push`），KeepAlive 下长期停留会持续累积 DOM/内存；没有虚拟列表或上限。
- 首页 `cacheCondition.limit` 硬编码为 `10`（`src/views/HomeView.vue:50-60`），而 store 实际页大小是 `15`（`src/store/postStore.ts:37`；`usePostListCache` 同样硬编码 10，`src/composables/usePostListCache.ts:35-45`）。恢复缓存后可能按 10 条翻页，增加请求次数并让 `hasMore` 判断偏移。
- 有新帖通知时 `onActivated` 走完整 `initialize('主页')`（`src/views/HomeView.vue:137-142`），而不是把新帖合并到现有列表，用户丢失已加载的翻页进度且多一次全量请求。
- 详情评论无分页/虚拟化（见 §2.6）。

**建议（收益中 / 成本中低）**

1. 用 `FEED_PAGE_SIZE` 统一初始化 `cacheCondition.limit`，删除两处魔数 10。
2. 信息流超过阈值（如 60～100 条）后启用虚拟列表，或至少限制保留条数并提示「回到顶部刷新」。
3. 新帖通知改为「顶部插入新帖」而非整页重载；保留滚动位置。
4. 详情评论改为分页加载（每页 20～30 条）；子评论默认折叠。

---

### 2.8 【P2】其他阻塞/后台请求

- 全局字体：`src/assets/font.css:1-57` 从 `fonts.gstatic.font.im` 加载 Ubuntu Mono 的 6 个 unicode 子集。只有代码块使用该字体时才下载，但 `font-display: swap` 仍会造成代码文本字体跳动；弱网/跨境下增加第三方依赖。建议自托管常用子集，或回退系统等宽字体。
- 通知/在线状态/聊天/推荐设置：`src/layouts/DefaultLayout.vue:121-142` 在布局挂载时并发发起多个请求/长连接。它们不直接阻塞路由渲染（此时 `isUserReady` 之后），但与首页首屏请求抢带宽。建议低优先级排队（`requestIdleCallback`、首屏后再启动），或将在线状态合并到一次请求。
- 路由守卫对未登录用户最多等待 1.5s（`src/router/index.ts:359-362`）；若首屏主要是游客访问，这段等待应尽量缩短或改为「先渲染公开骨架，再异步跳登录」。

---

## 3. 图片加载策略

### 3.1 【P0】缩放策略只覆盖详情正文，信息流/头像/旧图集原图直出

**现状**

| 场景 | 代码位置 | 是否缩放 | 说明 |
|---|---|---|---|
| 详情正文 Markdown 图片 | `src/components/MarkdownContainer.vue:122-134,150` | ✅ `?w=1600&q=82&v=2` | 仅对 `https://image.ssemarket.cn/` 生效，GIF/已带 `w=` 的原样返回 |
| 首页信息流预览图（`Photos` + 正文图片） | `src/components/card/PostCard.vue:40-56,271-279` | ❌ | 直接 `:src="img"`，未拼接任何缩放参数 |
| 热门评论预览图 | `src/components/card/PostCard.vue:75-88,286-294` | ❌ | 直接原图 |
| 头像 | `src/components/UserAvatar.vue:115-122` | ❌ | 直接 `post.UserAvatar`，渲染尺寸仅 28px（`src/components/card/PostCard.vue:346`）或 50px（`src/components/UserAvatar.vue:157-158`） |
| 作者挂载勋章 | `src/components/UserAvatar.vue:138-146` | ❌ | 18px 展示，原图直出 |
| 旧版 `Photos` 图集 | `src/components/OldImages.vue:15-21` | ❌ | CSS 100×100（`:26-29`），原图直出 |
| 商品图 | `src/components/card/ProductCard.vue:31` | ✅ | `/uploads/` → `/resized/`，可复用该模式 |
| 详情页点击放大 | `src/components/MarkdownContainer.vue:293-294` | ✅ | 放大时才取 `data-original` 原图 |

仓库内已有明确的量级说明：`src/components/MarkdownContainer.vue:117-118` 注释「线上 p50=1.28MB / p90=7.5MB 的原图直出是图床慢速的主要放大器」。当前只有详情正文接入了缩放，**信息流 15 张卡片 × 最多 9 张预览图、每张卡片一个头像，全部按原图请求**，是更大的放大器。

**问题与影响**

- 首页 LCP 很可能就是第一张预览图；p90 7.5MB 的单图在 4G 下需要数秒，直接决定 LCP。
- 头像以 28～50px 展示却下载原图，解码内存与流量都严重浪费。
- 图床/MinIO 出口流量与缓存压力成倍增加。

**建议（收益极高 / 成本低）**

1. 抽一个统一的 `imageVariant(url, { width, quality, fmt })` 工具，复用 `toImagebedPreviewURL` 的边界规则（仅自家图床改写、GIF/已带参保持原样）。
2. 信息流预览图按栅格宽度取 320～480px；头像取 64px（2x 用 96/128px）；旧图集取 200px；勋章取 36px。
3. 卡片图保留 `data-original`，点击进详情后再看原图（与现有 Viewer 模式一致）。
4. 先做「单 URL 缩放参数」即可获得大部分收益；`srcset` 见 §3.3。

---

### 3.2 【P0】首屏图片被 `loading="lazy"` 推迟

**现状**

- 详情正文所有图片统一 `loading="lazy"`（`src/components/MarkdownContainer.vue:149-150`），包括正文第一张、通常也是 LCP 的图片。
- 信息流图片统一 `loading="lazy"`（`src/components/card/PostCard.vue:276,291`），第一张卡片图片也在其中。
- 头像统一 `loading="lazy"`（`src/components/UserAvatar.vue:119,144`），包括首屏卡片头像。

**问题与影响**

- 浏览器原生懒加载要等布局完成、元素接近视口后才发起请求，等于把 LCP 图片的请求推迟到首屏渲染之后；对 LCP 是负优化。
- 首屏头像延迟出现，视觉上像「加载慢」。

**建议（收益高 / 成本低）**

1. 首屏第一张内容图/第一张卡片图设置 `loading="eager"` + `fetchpriority="high"`；其余保持 `lazy`。
2. 头像可保持 `lazy`（小图、非 LCP），但首屏作者头像建议 `eager`。
3. 详情正文可按索引处理：前 1～2 张 `eager`，其余 `lazy`；或基于 IntersectionObserver 在首屏稳定后再批量加载。
4. `decoding="async"` 保留（当前已普遍使用）。

---

### 3.3 【P1】缺少尺寸与响应式声明（CLS / 移动端浪费）

**现状**

- 信息流九宫格已用 `aspect-ratio` 预留空间（`src/components/card/PostCard.vue:461-510`），这部分做得好。
- 头像容器固定尺寸（`src/components/UserAvatar.vue:252-269`），CLS 风险低。
- 正文 Markdown 图片渲染没有 `width` / `height`（`src/components/MarkdownContainer.vue:150`），图片加载完成后高度跳变，阅读位置可能被顶走。
- 旧图集固定 100×100（`src/components/OldImages.vue:26-29`），但无占位底色/失败兜底。
- 全仓库没有 `srcset` / `sizes` 用于帖子图片；`<picture>` 只出现在皮肤背景（`src/components/skin/SkinBackground.vue:14-20`、`src/components/skin/FestivalSplash.vue:80-88`）。
- 正文图片固定 `w=1600`（`src/components/MarkdownContainer.vue:133`），手机端（内容宽度约 360～430 CSS px）下载了约 4 倍于需要的像素。

**问题与影响**

- 正文图片造成 CLS，影响阅读体验与 Core Web Vitals。
- 固定 1600 宽在移动端浪费带宽与解码时间；桌面 720px 内容宽度也用不到 1600。
- 没有 `fmt` 参数，图床注释明确支持 `?w=&h=&q=&fmt=`（`src/components/MarkdownContainer.vue:117`），当前未利用 WebP/AVIF 协商。

**建议（收益中高 / 成本中）**

1. 图片 URL 增加 `fmt=webp`（或根据 `Accept` 由图床自动协商）；质量保持 75～82。
2. 生成 `srcset` 并配 `sizes`，例如正文：
   ```html
   <img src="...?w=800&q=80&fmt=webp"
        srcset="...?w=480 480w, ...?w=800 800w, ...?w=1600 1600w"
        sizes="(max-width: 768px) 100vw, 720px" ...>
   ```
3. 若接口能返回图片宽高，渲染时写入 `width`/`height`；否则至少给 Markdown 图片一个 CSS `aspect-ratio` 占位（如 16/9）或骨架底色。
4. 失败兜底：统一 `@error` 替换占位图/隐藏，避免破图标。

---

### 3.4 【P1】发帖图片上传未接入已有的客户端压缩

**现状**

- 仓库已有完整的压缩工具：`src/utils/compressImage.ts:103-177`，默认最长边 1920、质量 0.85、输出 WebP（不支持时回退 JPEG），并对 GIF/动画 WebP/APNG/HEIC 做原样放行（`:80-108`）。
- 但它目前只被皮肤库和个人资料使用：
  - `src/components/skin/CustomSkinLibrary.vue:20,116`
  - `src/views/UserProfileView.vue:20,119`
- 发帖/评论的 Markdown 编辑器直接上传原始文件：`src/components/MarkdownEditor.vue:80-95` → `src/api/editPostAndComment/utils.ts:39-85` 的 `uploadPhoto(file)`，上传前没有调用 `compressImageFile`。
- 上传通道为 tus（`src/api/editPostAndComment/utils.ts:1-16`），单文件上限 150MB、分片 2MB。

**问题与影响**

- 相机原图常见 3～10MB，直接上传导致发帖等待长、图床存储大、后续所有展示端都要为原图付出流量。
- 压缩工具已经写好且有动画/HEIC 兼容分支，接入成本很低。

**建议（收益高 / 成本低）**

1. 在 `MarkdownEditor.upload` 调 `uploadPhoto` 前调用 `compressImageFile(file, { maxEdge: 1920, quality: 0.85 })`；GIF/动画路径由工具内部原样返回。
2. 上传进度提示沿用现有 `imageUploading` 状态（`src/components/MarkdownEditor.vue:71-95`）。
3. 展示端仍保留缩放（§3.1），形成「上传压缩 + 展示缩放 + 点击原图」三层策略。

---

### 3.5 【P2】静态图片资产与格式

**现状**

- `src/assets/` 下存在大 PNG：
  - `coin-dialog-pet.png` 约 1.1 MB（`src/components/CoinThrowDialog.vue:5`）
  - `coin-icon.png` 约 200 KB（`src/components/CoinThrowButton.vue:4`、`CoinThrowDialog.vue:6`）
  - `coin-mascot-1/2.png` 各约 176 KB（`CoinThrowDialog.vue:7-8`）
- `public/img/1.jpg` 约 1.8 MB、`2.jpg`/`3.jpg` 各约 1.1 MB；在当前 `src` 中搜索不到 `/img/...` 引用，疑似历史资源（需单独确认，本次不删除）。
- `public/default-avatars/*.jpg` 每张约 16～20 KB，共 10 张。
- `public` 目录合计约 8.7 MB，会随发布整体上传；未被引用的文件不增加用户下载，但增加发布体积与维护噪音。

**建议（收益中 / 成本低）**

1. 大 PNG 优先转 WebP/AVIF（宠物图 1.1 MB → 通常 100～300 KB），并按实际展示尺寸导出。
2. 确认 `public/img/*.jpg` 是否仍被使用；未使用则另开清理需求单删除。
3. 默认头像可转 WebP 并生成多尺寸，或使用 SVG/纯色首字母占位。

---

### 3.6 【P2】CDN 与缓存头

**现状**

- `public/_headers:1-10`：
  - `/*.html` 与 `/`：`Cache-Control: no-cache, no-store, must-revalidate`；
  - `/assets/*`：`Cache-Control: max-age=31536000, immutable`。
- 静态资源文件名带 hash（Vite 默认），`/assets/*` 的 immutable 配置正确。
- 但 HTML 使用 `no-store`，意味着每次访问都不能复用，也无法走 304，必须完整下载 HTML。
- 图床 `https://image.ssemarket.cn/` 的缓存头不在本仓库内；代码注释（`src/components/MarkdownContainer.vue:117-133`）说明图床支持缩放参数并在 MinIO 落缓存，且曾出现 `immutable` 缓存空图的故障，因此用 `v=2` 穿透。
- `_headers` 是 Cloudflare Pages 的配置；仓库同时有 GitHub/Gitee 部署（`.github/workflows/gitee.yml`），线上若由 Nginx 托管，需要单独确认该文件是否生效。

**建议（收益中 / 成本低，需运维确认）**

1. HTML 从 `no-store` 改为 `no-cache`（允许 ETag/304）或短 `max-age` + 重新验证，减少重复访问的 HTML 下载。
2. 图床响应确认带 `Cache-Control: public, max-age=31536000, immutable`，且缓存键包含 `w/q/fmt/v`；保持 `v=2` 参数语义不删除（`src/components/MarkdownContainer.vue:130-133`）。
3. 确认生产环境实际托管方式与 `_headers` 的生效范围，避免「仓库里配了但线上没生效」。
4. 静态资源可加 `Link: <...>; rel=preload` 或 HTTP/2/3 推送替代方案；至少先做 `preconnect`。

---

## 4. 改进清单（按 收益 / 成本 排序）

> 收益为定性/量级估计，需按 §5 复测。成本按「改动面 + 是否需要后端/运维配合」评估。

| 顺序 | 优先级 | 改进项 | 预期收益 | 成本 | 涉及位置 | 验收指标 |
|---:|---|---|---|---|---|---|
| 1 | P0 | 路由视图立即渲染，SSO/用户信息/皮肤后台化 | FCP/LCP 减少 0.9～6s 白屏 | 中 | `App.vue:63-132`、`router/index.ts:348-369` | 冷启动 FCP < 1s（4G） |
| 2 | P0 | 首页去掉计数请求，`total` 复用；新帖探测单飞去重 | 首屏少 2～3 个 RTT，消除空白期 | 低 | `usePostView.ts:26-37`、`postStore.ts:67-82`、`HomeView.vue:124-131`、`newPostsStore.ts:41-73` | 首屏 browse 请求数 ≤ 2 |
| 3 | P0 | 信息流/头像/旧图集统一接缩放参数 | 图片字节预计下降 50%～90% | 低 | `PostCard.vue:40-56,271-294`、`UserAvatar.vue:116-146`、`OldImages.vue:15-21` | 首页图片总字节 < 1MB |
| 4 | P0 | 首屏首图 `eager` + `fetchpriority=high` | LCP 提前约 0.3～1s | 极低 | `MarkdownContainer.vue:150`、`PostCard.vue:276` | LCP 元素请求提前到 HTML 后首个 RTT |
| 5 | P1 | 详情页评论/抽奖与帖子请求并行 | 评论区提前 1～2 个 RTT | 低 | `PostDetailView.vue:191-214` | 评论出现时间 = 帖子 + 1 RTT |
| 6 | P1 | 音乐/皮肤浮层、Howler、ViewerJS、投币弹窗异步化；vendor 拆包 | 入口 JS 明显下降，TTI/TBT 改善 | 中 | `App.vue:13-20`、`musicStore.ts:2`、`MarkdownContainer.vue:6,20`、`CoinThrowButton.vue:7`、`vite.config.ts:44-71` | 入口 chunk gzip 下降 30%+ |
| 7 | P1 | Iconify 图标离线化（`@iconify-json` / 内联 SVG） | 去掉第三方运行时请求，图标即时显示 | 低～中 | `package.json:38` + 55 个使用文件 | `api.iconify.design` 请求 = 0 |
| 8 | P1 | 全局 CSS 按路由拆分 | 入口 CSS 减少约 30～50KB（未压缩） | 中 | `main.ts:7-16` | 首页首屏 CSS < 30KB gzip |
| 9 | P1 | 修复 Prism 双重高亮、DOMPurify hook 累积；去掉 cdnjs autoloader | 详情渲染长任务减半，去除第三方依赖 | 低 | `MarkdownContainer.vue:17,62,204,254-256,419-427` | 正文渲染长任务 < 200ms |
| 10 | P1 | 发帖图片上传接入 `compressImageFile` | 上传体积下降 70%+，后续展示全面受益 | 低 | `MarkdownEditor.vue:80-95`、`compressImage.ts:103-177` | 上传平均体积 < 1MB |
| 11 | P1 | 正文图片 `srcset` + `fmt` + `sizes` | 移动端图片字节再降 50%+ | 中 | `MarkdownContainer.vue:122-150` | 移动端正文图片 p75 < 300KB |
| 12 | P1 | 评论分页 / 虚拟列表；信息流上限或虚拟化 | 长评论/长列表不卡顿，内存可控 | 中～高 | `PostDetailView.vue:145-154,266-273`、`postStore.ts:80` | 1000 条评论首屏长任务 < 200ms |
| 13 | P2 | 新帖轮询轻量化、页面隐藏暂停、错误退避 | 后台流量与 DB 压力下降 | 低 | `newPostsStore.ts:41-114`、`DefaultLayout.vue:142` | 后台 1min 请求数 = 0 |
| 14 | P2 | 统一 `cacheCondition.limit` 为 `FEED_PAGE_SIZE` | 恢复缓存后翻页请求减少 | 极低 | `HomeView.vue:50-60`、`usePostListCache.ts:35-45`、`postStore.ts:37` | 恢复后页大小 = 15 |
| 15 | P2 | HTML 缓存头 `no-store` → `no-cache`；图床缓存头核验；preconnect | 重复访问更快，LCP 提前一个握手 | 低（需运维） | `public/_headers:1-10`、`index.html:1-23` | 二次访问 HTML 命中 304 |
| 16 | P2 | 大静态图转 WebP/AVIF；确认未引用图片 | 发布体积与首次使用体积下降 | 低 | `src/assets/*.png`、`public/img/*.jpg` | `coin-dialog-pet` < 300KB |
| 17 | P2 | 正文图片尺寸/占位/失败兜底 | CLS 降低，破图减少 | 中 | `MarkdownContainer.vue:150`、`OldImages.vue:15-21` | CLS < 0.1 |

---

## 5. 复测方法与验收建议

本次为静态审计，以下步骤用于改动前后对比：

1. **构建分析**
   ```bash
   pnpm install
   pnpm build:analyze
   ```
   记录入口 chunk、`vendor`、`markdown`、`prismjs` 的 gzip 体积；对照 `vite.config.ts:44-71` 的分包结果。
2. **Lighthouse（移动端，4G 节流，冷缓存）**
   - 首页：FCP、LCP、TBT、CLS、Speed Index。
   - 详情页（选一条带 3 张图 + 代码块 + 20 条评论的帖子）。
   - 建议目标（p75）：LCP < 2.5s、TBT < 200ms、CLS < 0.1。
3. **Network Waterfall**
   - 首页首屏 `/auth/*` 请求数、串并行关系、响应大小；
   - 首页图片请求数与总字节（按 `image.ssemarket.cn` 过滤）；
   - 是否仍存在 `api.iconify.design` / `cdnjs.cloudflare.com` / `fonts.gstatic.font.im` 请求。
4. **Performance 面板**
   - 录制详情页首屏，确认 Markdown 渲染是否仍有重复高亮长任务；
   - 记录 `LCP` 元素与其 `fetchpriority`。
5. **RUM（建议后续接入）**
   - `PerformanceObserver` 采集 LCP/CLS/longtask，按页面、机型、网络分桶；
   - 后端记录 `/auth/browse` 的 p50/p90 响应体大小，确认列表是否返回全文。
6. **回归验证**
   - 图片缩放后必须验证：GIF 未被缩放、外站图片未被追加参数、点击放大仍取 `data-original`、`v=2` 缓存穿透参数保留。
   - 首屏异步化后必须验证：未登录/慢 SSO 下仍能正常渲染公开页面骨架、登录态最终正确刷新、皮肤不闪回。

---

## 6. 已做对的部分（改动时不要回退）

- 路由级代码分割：`src/router/index.ts:13-310`。
- 布局头部/导航异步组件：`src/layouts/DefaultLayout.vue:25-36`。
- 首页 KeepAlive + 滚动位置恢复：`src/layouts/DefaultLayout.vue:220-223`、`src/views/HomeView.vue:133-156`。
- 触底分页 IntersectionObserver + 240px 预取：`src/components/PostList.vue:21-37`。
- 首屏骨架屏：`src/components/PageSkeleton.vue`、`src/components/PostList.vue:64`、`src/views/PostDetailView.vue:223`。
- 详情 Markdown 图片缩放 + `data-original` 放大原图：`src/components/MarkdownContainer.vue:122-150,278-299`。
- 图片上传压缩工具（含动画/HEIC 兼容）：`src/utils/compressImage.ts:80-177`。
- 头像加载失败回退默认头像：`src/components/UserAvatar.vue:71-74`。
- 勋章批量请求避免 N+1：`src/composables/useWornBadge.ts:19-42`。
- 商品图 `/uploads/` → `/resized/`：`src/components/card/ProductCard.vue:31`。
- 构建期 DNS 预解析插件：`plugins/vite-plugin-dns-prefetch.ts:55-78`（可升级为 preconnect）。
- 大部分图片已带 `loading="lazy"` / `decoding="async"`（72 处 `<img>`，示例见 `src/components/card/PostCard.vue:276`、`src/components/UserAvatar.vue:119`）。

---

## 7. 待确认项与风险

1. **后端列表 payload**：`/auth/browse` 是否返回每条帖子的完整 `Content` 与 `HotComment.content`（类型定义 `src/types/post.d.ts:1-30`）。若返回全文，建议另开接口/字段只返回摘要与缩略图 URL；这需要后端配合，不在本前端需求内实施。
2. **图床能力**：`fmt`、`h`、缓存头、最大缩放宽度需与图床/运维确认；代码注释只说明支持 `?w=&h=&q=&fmt=`（`src/components/MarkdownContainer.vue:117`）。
3. **部署形态**：`public/_headers` 是否在生产生效（Cloudflare Pages）还是由 Nginx 托管；若为后者，需要单独修改网关配置。
4. **Iconify**：本次通过依赖与代码搜索判断为运行时 API 拉取；建议用 DevTools 复核。如果上游模板/插件已离线化，则该项优先级下调。
5. **未引用静态资源**：`public/img/1.jpg`（1.8MB）等在 `src` 中未搜索到引用，但可能有外部/历史引用；清理需另开需求单并做 404 监控。
6. **本轮未做任何源码修改**：所有建议均为后续需求输入；本报告只新增 `docs/perf-audit.md`。

---

*报告结束。需求单 SK-3993C864。*
