export interface RatingCategory {
  categoryID: number
  name: string
  description: string
  postCount: number
  isOfficial: boolean
  sortOrder: number
}

export interface RatingPostItem {
  ratingPostID: number
  categoryID: number
  categoryName: string
  userID: number
  userName: string
  userScore: number
  userTelephone: string
  userAvatar: string
  userIdentity: string
  title: string
  content: string
  like: number
  comment: number
  browse: number
  createdAt: string
  isLiked: boolean
  photos: string
  averageRating: number
  stars: [number, number, number, number, number]
  raterCount: number
}

export interface RatingPostDetail extends RatingPostItem {
  userStar: number
}

export interface RatingCommentItem {
  commentID: number
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
  authorRating: number
}
