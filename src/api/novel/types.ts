export type NovelTargetType = 'book' | 'chapter' | 'paragraph'

export interface NovelCategoryItem {
  name: string
  count: number
}

export interface NovelItem {
  novelID: number
  title: string
  authorID: number
  authorName: string
  coverURL: string
  category: string
  intro: string
  status: string
  chapterNum: number
  wordNum: number
  readNum: number
  shelfNum: number
  commentNum: number
  // 投币与评分：coinNum/ratingCount/ratingAvg 是公开数据，
  // myCoins/myRating 是当前用户自己的状态（0 = 没投过 / 没评过）。
  coinNum: number
  ratingCount: number
  ratingAvg: number
  myCoins: number
  myRating: number
  latestChapterID: number
  latestChapterTitle: string
  latestChapterAt: string | null
  createdAt: string
  updatedAt: string
  onShelf: boolean
  progressPercent: number
  progressChapterID: number
  progressChapterNum: number
}

export interface NovelDetail extends NovelItem {
  authorAvatar: string
  authorScore: number
  authorIdentity: string
  authorIntro: string
  isAuthor: boolean
}

export interface NovelChapterItem {
  chapterID: number
  novelID: number
  chapterNum: number
  title: string
  wordNum: number
  commentNum: number
  readNum: number
  createdAt: string
}

export interface NovelParagraphItem {
  index: number
  text: string
  /** 非空表示这一段是图片（正文里单独一行的图片），前端按图片渲染。 */
  imageURL: string
  commentNum: number
}

export interface NovelChapterAdjacentItem {
  chapterID: number
  chapterNum: number
  title: string
}

export interface NovelChapterDetail {
  chapter: NovelChapterItem
  novelID: number
  novelTitle: string
  authorName: string
  paragraphs: NovelParagraphItem[]
  authorNote: string
  prev: NovelChapterAdjacentItem | null
  next: NovelChapterAdjacentItem | null
  onShelf: boolean
  progressPercent: number
}

export interface NovelCommentItem {
  commentID: number
  novelID: number
  chapterID: number
  paragraphIndex: number
  targetType: NovelTargetType
  paragraphExcerpt: string
  authorID: number
  author: string
  authorTelephone: string
  authorScore: number
  authorAvatar: string
  authorIdentity: string
  commentTime: string
  content: string
  likeNum: number
  isLiked: boolean
}

export interface NovelListQuery {
  keyword?: string
  category?: string
  status?: string
  limit?: number
  offset?: number
}

export interface NovelCommentQuery {
  novelID: number
  targetType?: NovelTargetType
  chapterID?: number
  paragraphIndex?: number
  limit?: number
  offset?: number
}

// ---------------------------------------------------------------------------
// 积分 / 经验体系（后端 domain/novel_points.go 口径）
// ---------------------------------------------------------------------------

/** 流水事件：currency 为 exp（经验）或 point（积分，amount 以「分」计）。 */
export interface NovelPointsEvent {
  event: string
  label: string
  currency: string
  amount: number
}

export interface NovelPointsSummary {
  experience: number
  /** 作者积分，以「分」计（1 积分 = 10 分） */
  pointsFen: number
  /** 换算成「积分」的展示值 */
  pointsScore: number
  todayExp: number
  checkInDay: string
  checkInStreak: number
  byEvent: NovelPointsEvent[]
}

export interface NovelLedgerItem {
  ledgerID: number
  novelID: number
  event: string
  label: string
  currency: string
  amount: number
  settledValue: number
  createdAt: string
}

export interface NovelCheckInResult {
  amount: number
  streak: number
  day: string
  already: boolean
}

// 打赏已下线（被投币体系替换）：NovelRewardResult 随之移除，
// 评分结果类型见 books.ts 的 NovelRatingResult。
