export interface Comment {
  PcommentID: number
  AuthorID: number
  Author: string
  AuthorTelephone: string
  AuthorScore: number
  AuthorTitle?: string
  AuthorAvatar: string
  AuthorIdentity: string
  CommentTime: string
  Content: string
  LikeNum: number
  DenyNum: number
  SubComments: SubComment[]
  IsLiked: boolean
  IsDenied: boolean
  /** 服务端判定：本人可删（含「以职位身份」发的评论——对外署名是职位小号，前端按 phone 判不出） */
  IsOwn?: boolean
}

export interface RatingComment extends Comment {
  AuthorRating: number
}

export interface SubComment {
  ccommentID: number
  author: string
  authorID: number
  authorScore: number
  authorTitle?: string
  authorTelephone: string
  authorAvatar: string
  authorIdentity: string
  commentTime: string
  content: string
  likeNum: number
  denyNum: number
  isLiked: boolean
  isDenied: boolean
  userTargetName: string
  showMenu: boolean
  /** 服务端判定：本人可删（含义同 Comment.IsOwn） */
  isOwn?: boolean
}
