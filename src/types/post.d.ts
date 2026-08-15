export interface Post {
  PostID: number
  UserID?: number
  UserName: string
  UserScore: number
  UserTelephone: string
  UserAvatar: string
  UserIdentity: string
  Title: string
  Content: string
  Like: number
  Comment: number
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
  Photos: string
  Tag: string
}

export type PostType = 'post'
