# newSSE（软工集市主站）Evia 埋点上报方案

> 状态：切片 1–5 已实施并通过真实浏览器 → `/v1/collect` 202/逐事件 accepted → ClickHouse → content-worker → 授权读取验证；点击热力、页面访问画像、小秋加密内容和会话回放首个全链均已落地。Evia 已提供签名公钥配置、telemetry token、KMS/JWK 解包、通用 `sys.content_chunk` 以及正式回放发现/安全快照工作区。事件经浏览器来源 + 完整发布目录上报，不含任何凭据。

## 一、站点结构盘点

- 技术栈：Vue 3.5 SPA（history 路由，base `/new/`）+ vue-router 4；生产分支 `hotfix/login-button-20260826`。
- 48 条路由 / 37 个视图：首页、分区列表/分区、帖子流/帖子详情、搜索、热榜、投票、评分区（rating）、简历（resume）、商城（shop/product/sale/myproducts）、音乐、私信（messages/chat）、AI 小秋（smart-xiaoqiu）、AI 解读（rag-preview）、通知、反馈、个人主页、登录/注册/SSO/找回、年报、运维代理（connect）。
- 身份：JWT `accessToken/refreshToken`（localStorage），`userInfo.phone` 为站内用户键；匿名访客无 ID。
- 交互 API 完整清单（`src/api/`）：`likePost/likePostComment/likeCommentComment`、`savePost`（收藏）、`toggleWatchPost`（码住）、`sendComment/sendPComment`（评论/楼中楼）、`submitDraft`（发帖）、`submitVote`、评分区 `createRatingPost/likeRatingPost/likeRatingComment/submitRatingStar`、商城 `createShopProduct/saleProduct/markShopProductSold/handleProduct`、简历 `uploadResume/updateResume/deleteResume/downloadResume`、私信 `getChatHistory/closeConversation/recallChatMessage`、AI `fetchAssistPost/fetchAssistFollowup/sendAssistFeedback`、搜索 `searchPostsByTitle/searchRagPosts/fetchHotQueries`、令牌 `createAPIToken/revokeAPIToken`、抽奖 `participateLottery` 等。

## 二、埋点原则（对齐 Evia 语义）

1. **服务端确认优先**：点赞/收藏/发评论等以「API 返回 ok」为完成信号埋点（`client_observed` 但带操作结果）；仅曝光/浏览类用前端信号。
2. **上下文齐全**：公共 envelope 带 uid/anonymous/session/tab/sequence/page/navigation；`page_opened` 补 route path/template、来源、入口类型、视口/屏幕、设备、语言、时区、网络，`page_exited` 补停留时长。
3. **身份对齐**：登录/注册成功后调 `identify(uid)`；登出调 `reset()`；匿名期事件带 `anonymous_id`，由服务端身份图后续归并。
4. **内容分级**：普通资源内容不复制正文，报 post/product/resume 等资源 ID；搜索词作为 UTF-8 string 原文上报（可直接 TopN/筛选）；小秋对话原文必须字段级混合加密后分片上报，绝不在加密失败时降级明文；令牌、cookie 永不采集。

## 三、事件清单（建议目录，均带环境/会话/页面上下文）

### A. 页面与导航（自动，SDK `autoPageViews` + 显式 route_name）
| 事件 | 触发 | 关键属性 |
| --- | --- | --- |
| `page_opened` | 每个视图首次进入（router.afterEach） | route_name/path/template, from_route, entry_type, referrer_host, device_type, viewport/screen, language, timezone_offset, connection_type |
| `page_exited` | 路由切换 / pagehide | route_name/path/template, dwell_ms, exit_type |
| `partition_viewed` | 进入分区页 | partition_name, page, order |

### B. 帖子消费链（用户示例展开）
| 事件 | 触发 | 关键属性 |
| --- | --- | --- |
| `home_browse` | 首页信息流加载/翻页 | order(hot/new...), page, card_count |
| `post_opened` | 点进帖子详情 | post_id, partition, from(home/search/heat/notice) |
| `post_read` | 帖子停留 ≥Ns 或滚到底 | post_id, dwell_ms, scrolled_ratio |
| `post_liked` | 点赞 API ok | post_id, liked(1), from(detail/card) |
| `post_like_cancelled` | 取消点赞 | post_id |
| `post_saved` / `post_save_cancelled` | 收藏切换 | post_id |
| `post_watched` / `post_watch_cancelled` | 码住切换 | post_id |
| `comment_sent` | 回复发布 ok | post_id, parent_comment_id(0=楼主), length_bucket |
| `comment_liked` | 评论点赞 ok | post_id, comment_id, level(1/2) |
| `post_shared` | 分享复制链接 | post_id, channel(clipboard/...) |
| `post_exited` | 退出帖子详情 | post_id, total_dwell_ms |

### C. 站内其他模块
| 事件 | 触发 | 关键属性 |
| --- | --- | --- |
| `search_performed` | 搜索提交 | keyword(UTF-8 原文), keyword_length, search_id, scope(post/rag) |
| `hot_list_viewed` | 热榜页 | tab |
| `vote_submitted` | 投票 ok | vote_id, option_count |
| `rating_post_created` / `rating_comment_sent` / `rating_star_submitted` | 评分区 | rating_post_id, stars |
| `shop_product_viewed` / `product_purchase_opened` | 商城 | product_id, price_bucket |
| `product_sold` / `product_listed` | 卖家操作 ok | product_id |
| `resume_uploaded` / `resume_viewed` / `resume_downloaded` | 简历 | resume_id |
| `music_played` / `music_paused` / `music_next` | 播放器 | track_id, play_ms |
| `message_thread_opened` / `message_sent` | 私信 | thread_anonymous, msg_type |
| `chat_opened` | 打开小秋对话 | entry(floating/header/page) |
| `chat_message_sent` | 发送对话 | round, has_file, length_bucket |
| `assist_invoked` / `assist_feedback` | 帖子 AI 解读 | post_id, helpful |
| `notice_opened` / `notice_followed` | 通知跳转 | notice_id, kind |
| `login_succeeded` / `register_succeeded` / `logout` | 账号 | method(password/sso), sso_provider |
| `api_token_created` / `api_token_revoked` | 令牌管理 | scope_count |

### D. 系统事件（Evia SDK 自动，无需业务代码）
`sys.page_view`（autoPageViews）、`sys.identity_link`（autoIdentityLink + identify）、`sys.session_end`（autoSessionEnd）、`sys.page_scroll`（autoPageScrolls，阅读深度）、`sys.heatmap_click`（autoHeatmapClicks，坐标 + 无内容结构路径）。

### E. 小秋对话敏感内容

- `chat_action`：open/new_conversation/send/stop/response_completed/response_error 等操作，content 不在此事件中。
- Evia 平台通用保留事件 `sys.content_chunk`：`content_type=ai_chat_message`、`stream_id=conversation`、`item_id=message`、`actor_type=user|assistant`；newSSE 只负责业务映射，不把“小秋”字段下沉到平台。用户原文与助手最终答复在流结束后一次采集（不逐 token），UTF-8 按 ≤598 bytes 分片、最多 32 块。
- 每条 item 随机 AES-256-GCM key，每块独立 nonce 并 padding 到固定 600 bytes；AES key 用 RSA-OAEP-256 公钥包装。AAD 绑定 project/environment/stream/item/actor/chunk/count/length/status。私钥不进入浏览器，加密失败拒绝明文降级。
- 测试证据：1248-byte 中文合成内容分 3 块，collect 请求不含原文，202/accepted；本机测试私钥解密与原文一致，ClickHouse 只见 ciphertext（无 `content` 字段）；Evia content-worker、KMS/JWK 解包、保护对象和 owner/content.read API 已闭环。

### F. 会话回放（平台通用密文流上的业务映射）

- newSSE 将 sanitized DOM snapshot 映射为 `content_type=session_replay_snapshot`，MutationObserver/click/scroll/resize/navigation 记录映射为 `session_replay_mutations`；平台只理解通用 stream/item/actor/content_type。
- 默认关闭；按环境采样并在标签页内固定采样结果和 stream UUID。默认单会话 gzip+base64url 编码字符预算 2 MiB，可配置 64 KiB–8 MiB（容量报告另列实际 gzip bytes）；snapshot 最大 4 Mi 字符，3 秒/100 records flush，scroll 250 ms 限速。
- snapshot 删除脚本/iframe/object/embed、事件属性、nonce/srcdoc/value/token 属性，URL 去 query/hash；输入框、textarea、select、contenteditable、`data-evia-mask` 和 `.evia-mask` 统一掩码。
- JSON 经 gzip + base64url + 10,000 字符分段，再复用 AES-256-GCM/RSA-OAEP-256 `sys.content_chunk` 链路；每个 item 控制在 SDK 单个 20-event batch 内，显式 flush 并等待逐事件 accepted 后才记为已交付，队列满时先 flush 后重试，避免高体积 DOM 静默丢段。
- snapshot 延迟到路由稳定后 2 秒，并内联最多 1 MiB 可读 CSSOM；保留 Vue 只读 scope 属性 `data-v-xxxxxxxx/data-v-app`，正式 sandbox 预览可恢复 scoped 样式，同时继续删除其他任意 data 属性。
- v2 内层协议增加 document/payload/record 单调序号、capture-time route/time 和稳定 node ID；snapshot 用 `data-evia-rid`/惰性 comment marker 标识 element/text/comment，mutation 精确记录 text、attribute null/empty、child removed IDs/完整新增片段/before anchor。快速路由取消陈旧 snapshot，序号缺口由播放器停止而非猜测；v1 保持静态快照兼容。
- 已登录真实 E2E：登录后遍历首页→帖子详情→真实顶部搜索“大创”→热榜/分区/评分/商城/音乐/消息/小秋/简历/投票共 13 个节点，15 类事件；最终样式流 62 items 在浏览器 accepted 计数、ClickHouse distinct item 和 PostgreSQL 完整 item 三方严格一致，892 个密文块全为 822 字符、CH 明文 `content`=0，78 批 collect 全 202。搜索 deep-link 缺失 search_id 时生成 UUID，修复了 `search_results_viewed` 的 422 schema rejection。验证见 Evia `docs/verification/session-replay-2026-11-22.md`。

## 四、上报充分性设计（防丢/防重/可核对）

1. **SDK 接入**：`createEviaClient({ endpoint, projectId, environment, writeKey, autoPageViews, autoIdentityLink, autoSessionEnd, autoPageScrolls, persistQueue, persistSession })`；`router.afterEach` 里 `navigate({routeName})` 对齐页面上下文。
2. **服务端确认门控**：所有写操作事件在 API resolve 且 `ok===true` 后 `emit`；失败/未知不emit或emit带 `outcome` 字段（二选一，建议带 outcome 以量化失败）。
3. **不丢**：`persistQueue` 开启（刷新重投、去重幂等）；`flush()` 在 `pagehide` 由 SDK keepalive 兜底。
4. **不过量**：曝光类（卡片曝光）如需要按 50% 抽样 + 分页批量合并为单事件（`card_ids` 数组 ≤20）；滚动深度用 SDK 内建限速（12/min）。
5. **核对口径**：Evia 侧按 `event_key × 天` 对账「上报数 vs API 网关侧业务操作数」，差异率进看板。

## 五、实施切分

| 切片 | 内容 |
| --- | --- |
| 1 | SDK 引入 + 路由上下文 + 自动事件（A/D 类）+ 登录身份对齐 |
| 2 | 帖子消费链（B 类，用户示例全集） |
| 3 | 其余模块（C 类）+ 曝光抽样 + 对账看板 |
| 4 | 热力图坐标（`sys.heatmap_click` SDK 自动采集） |
| 5 | 会话回放：采样/预算、DOM 掩码、增量记录、gzip 分段、通用密文内容链路 |

## 六、边界

- 本文事件键为 newSSE 业务事件（发布到 Evia 项目目录），与 `sys.*` 平台事件并列；须先在 Evia 注册/发布才能上报（走 `activity-publish-events` 流程）。
- 搜索词按产品分析需求以 UTF-8 原文上报并用 `search_id` 贯穿结果曝光与点击；不得混入令牌、cookie 或表单内容。
- 本地 dev 直连生产 API；埋点验证需用独立 Evia 项目与环境，避免污染生产数据。
