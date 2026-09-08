export interface PendingAssist {
  partition: string
  title: string
  content: string
  postID: number
}

// 主页发帖后 AI 卡片已于 2026-09-08 移除（智能应答只在帖子详情页按需生成），
// 此处仅保留类型供 api/assist.ts 使用。
