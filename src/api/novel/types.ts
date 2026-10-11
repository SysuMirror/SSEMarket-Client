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
