export interface Post {
  PostID: number
  UserID?: number
  UserName: string
  UserScore: number
  UserTitle?: string
  UserTelephone: string
  UserAvatar: string
  UserIdentity: string
  Title: string
  Content: string
  Like: number
  Comment: number
  // Coin 被投币总数（含历史投票折算）；MyCoins 我累计投了几个（0–2）
  Coin?: number
  MyCoins?: number
  Browse: number
  Heat: number
  PostTime: string
  IsSaved: boolean
  IsLiked: boolean
  IsWatched?: boolean
  IsPrivate?: boolean
  IsAnonymous?: boolean
  IsOwner?: boolean
  IsLottery?: boolean
  // 置顶相关字段(主页 BrowseResult.pinned 中返回;详情接口也会返回用于按钮态判断)
  IsPinned?: boolean
  PinnedAt?: string
  PinnedExpiresAt?: string
  // 热门评论预览(Browse 列表返回,详情接口无此字段)
  HotComment?: HotComment
  Photos: string
  Tag: string
}

// HotComment 浏览列表热门评论预览。
// 后端取每个帖子点赞最多的一级评论(并列按字数倒序),无评论时该字段为 undefined。
export interface HotComment {
  id: number
  userID: number
  userName: string
  content: string
  likeNum: number
  createdAt: string
}

// BrowseResult 后端 /auth/browse 响应结构(主页用)。
//   - pinned: 主页未过期置顶帖(最多 5,按 PinnedAt DESC)
//   - posts:   正常帖(已排除 pinned 中的 PostID,避免重复)
//   - total:   正常帖总数(不含 pinned)
export interface BrowseResult {
  pinned: Post[]
  posts: Post[]
  total: number
}

export type PostType = 'post'
