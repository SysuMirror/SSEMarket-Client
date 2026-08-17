# 帖子置顶功能设计

**日期**:2026-08-16
**状态**:已确认,准备实施
**目标**:在主页列表顶部展示指定用户的置顶帖;前期仅开放给"秋"(userID=278),后期可能开放给所有用户。

## 关键约束(用户确认)

1. **范围**:仅主页列表顶部置顶。其他场景(分区/搜索/用户主页/历史)不显示置顶。
2. **上限**:每个用户同时最多 5 个置顶帖。已有 5 个时无法再置顶。
3. **有效期**:每次置顶 1 小时,到期自动失效。
4. **去重**:置顶帖不会再次出现在分页列表中(避免重复展示)。
5. **排序行为**:任何排序(time_desc/like_desc/comment_asc 等)下,置顶帖始终在顶部。多个置顶帖之间按 `pinned_at` 倒序(最近置顶的在上)。
6. **操作入口**:
   - 发帖表单中"同时置顶 1 小时"勾选框(仅秋可见)
   - "我的动态"/"历史"列表中,对本人非匿名帖点"置顶/取消置顶"按钮
7. **权限**:目前仅"秋"(userID=278)。后期可能开放所有人 — 权限判断集中在 service 层一处。
8. **匿名帖**:匿名帖同样可被置顶,在主页展示时仍按匿名规则脱敏。匿名徽章与置顶徽章可共存。

## 数据模型

### `posts` 表新增字段

```sql
ALTER TABLE posts
  ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否当前被置顶',
  ADD COLUMN pinned_at DATETIME NULL COMMENT '置顶时间(置顶帖间按此倒序)',
  ADD COLUMN pinned_expires_at DATETIME NULL COMMENT '置顶过期时间(到点失效)',
  ADD INDEX idx_pinned_home (is_pinned, pinned_expires_at);
```

- `is_pinned`:被动过期模式。过期后字段仍为 1,但查询时通过 `pinned_expires_at > NOW()` 过滤。下次该帖被置顶/取消时三个字段会被重置。
- `pinned_at`:置顶帖之间的排序键。
- `pinned_expires_at`:过期判定字段。
- 5 个上限的校验:`SELECT COUNT(*) FROM posts WHERE userID=? AND is_pinned=1 AND pinned_expires_at > NOW()`。无独立计数表。

## 方案选择:Repo 层双查询合并

候选方案对比后选定 **方案 B**(详见下表)。

| 方案 | 描述 | 评价 |
|------|------|------|
| A. DB UNION | 单 SQL `UNION ALL` 合并 | GORM 难维护,前端无法区分 |
| **B. Repo 层合并** | service 双查询,BrowseResult 返回 pinned+posts+total | **采用**,职责清晰,去重靠 SQL |
| C. 独立接口 + 前端 merge | 新增 `/auth/pinnedPosts` 接口 | 前端复杂度高,翻页去重易出错 |

## 后端架构

### domain/post.go

```go
type Post struct {
    // 既有字段...
    IsPinned        bool
    PinnedAt        *time.Time
    PinnedExpiresAt *time.Time
}

type BrowseResult struct {
    Pinned []*Post  // 未过期置顶帖(最多 5,按 PinnedAt DESC)
    Posts  []*Post // 正常帖(已排除 Pinned 中的 PostID)
    Total  int64  // 正常帖总数(不含 Pinned)
}
```

### repository/gorm/post.go

- `browseListSelect` 增加 `is_pinned, pinned_at, pinned_expires_at`
- 新增 `ListPinned(ctx, viewerUserID) ([]*Post, error)`:
  - `WHERE is_pinned=1 AND pinned_expires_at > NOW()`
  - `applyVisibility` + 仅主页可见性
  - `ORDER BY pinned_at DESC LIMIT 5`
- 改造 `ListBrowse(ctx, filter) (BrowseResult, error)`:
  - 先调 `ListPinned` 取出当前置顶 IDs
  - 原查询加 `WHERE postID NOT IN (:pinned_ids)`
  - 返回 `BrowseResult{Pinned, Posts, Total}`
- 新增 `PinPost(ctx, postID, userID, duration time.Duration) error`:
  - 校验同一帖子当前未置顶
  - 校验该用户当前未过期置顶数 < 5
  - 更新 `is_pinned=1, pinned_at=NOW(), pinned_expires_at=NOW()+duration`
- 新增 `UnpinPost(ctx, postID, userID) error`:
  - 重置三个字段(`is_pinned=0, pinned_at=NULL, pinned_expires_at=NULL`)

### service/post_service.go

- `Browse(ctx, filter) (BrowseResult, error)`:透传 repo
- 新增 `PinPost(ctx, postID, userID) error`:
  - 权限校验 `canPin(userID)`:目前硬编码 `userID == 278`
  - 校验是本人帖子
  - 调 `repo.PinPost(ctx, postID, userID, 1*time.Hour)`
- 新增 `UnpinPost(ctx, postID, userID) error`:校验本人 → 调 repo.UnpinPost
- `canPin(userID int) bool { return userID == 278 }`(集中一处,后期可改)

### controller/postController.go

- 改造 `Browse` 响应:`{ pinned: [...], posts: [...], total: N }`
- 新增 `POST /auth/pinPost { postID }` → `service.PinPost`
- 新增 `POST /auth/unpinPost { postID }` → `service.UnpinPost`
- `Post` 发帖接口接收 `pinned bool` 字段:为 true 时,发帖成功后调 `service.PinPost`

### 路由 route/routes.go

```
POST /api/auth/pinPost      # 置顶
POST /api/auth/unpinPost    # 取消置顶
```

### 关键设计点

- **权限**:集中 `service.canPin`,目前硬编码 userID=278,后期开放改一行。
- **过期**:被动过期。无定时任务。`ListPinned` 查询时 `WHERE pinned_expires_at > NOW()` 自动过滤。
- **匿名帖**:ListPinned 同样应用 `anonymizeAuthor`,匿名置顶帖仍匿名展示。匿名徽章与置顶徽章共存。

## 前端架构

### types/post.d.ts

```ts
export interface Post {
  // 既有字段...
  IsPinned?: boolean
  PinnedAt?: string
  PinnedExpiresAt?: string
}
```

### api/browse/getPost.ts

- `getPosts` 返回类型改为 `BrowseResult = { pinned: Post[]; posts: Post[]; total: number }`
- 新增 `pinPost(postID: number): Promise<boolean>`
- 新增 `unpinPost(postID: number): Promise<boolean>`
- `createPost` payload 新增 `pinned?: boolean`

### store/postStore.ts

- 状态拆为 `pinnedPosts: Post[]` 和 `posts: Post[]`
- `addPost` 只累加 `posts`
- `refreshPosts` 清空两个数组
- 新增 `refreshPinned()`:单独刷新置顶数组(取消置顶后局部刷新)
- 渲染时由调用方拼接 `[...pinnedPosts, ...posts]`

### 视图层

- `HomeView.vue`:渲染 `[...pinnedPosts, ...posts]`
- `PostCard.vue`:`IsPinned=true` 时在标题左上角显示"置顶"徽章
- `PostView.vue`(发帖表单):增加"同时置顶 1 小时"勾选框(仅当当前用户是秋时显示)
- `UserProfileView.vue`/`HistoryView.vue`:对本人非匿名帖卡片,若 `userID == 278`,显示"置顶/取消置顶"按钮

### 关键点

- **去重**:后端 `WHERE postID NOT IN (:pinned_ids)` 保证,前端无需去重
- **置顶徽章**:只在主页顶部显示,用户主页/历史里不显示
- **取消置顶后**:`refreshPinned()` 局部刷新;同时从 `posts` 里移除该帖(若已加载)

## 边界与错误处理

- **超过 5 个**:返回业务错误"置顶帖数量已达上限 5"
- **同一帖子重复置顶**:返回"该帖子已置顶"
- **对他人帖子置顶**:返回"无权限"
- **匿名帖置顶**:允许,展示时仍脱敏
- **过期帖仍 is_pinned=1**:不影响展示(查询过滤),不影响下次置顶(PinPost 会重置字段)
- **发帖时勾选 pinned 但权限不足**:发帖成功,但 pinPost 返回错误 → 帖子已发,前端提示"帖子已发布,但置顶失败:无权限"

## 实施任务清单

后端:
1. SQL migration(posts 表加 3 字段 + 索引)
2. model/post.go + domain/post.go 加字段
3. repository/gorm/post.go:ListPinned + 改造 ListBrowse + PinPost/UnpinPost + browseListSelect
4. service/post_service.go:Browse 改造 + PinPost/UnpinPost + canPin
5. controller/postController.go:Browse 响应改造 + pinPost/unpinPost 端点 + Post 接收 pinned 参数
6. route/routes.go:加路由
7. 编译 + 部署

前端:
8. types/post.d.ts 加字段
9. api/browse/getPost.ts:改 getPosts 返回类型 + 新增 pinPost/unpinPost
10. api/post/createPost.ts(或对应文件):加 pinned 参数
11. store/postStore.ts:状态拆分 + refreshPinned
12. HomeView.vue:拼接渲染
13. PostCard.vue:置顶徽章
14. PostView.vue:发帖表单勾选框
15. UserProfileView/HistoryView:置顶按钮
16. 构建 + 部署
