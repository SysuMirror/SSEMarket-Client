export interface PartitionItem {
  name: string
  icon: string
  key: string
  description: string
}

/** 内容分区：统一用 Tabler 图标，避免外链封面失效 */
export const CONTENT_PARTITIONS: PartitionItem[] = [
  { name: '学习交流', icon: 'tabler:school', key: 'study', description: '知识碰撞，学术思辨。' },
  { name: '生活日常', icon: 'tabler:coffee', key: 'daily-life', description: '言短情长，抒发心声。' },
  { name: '社团活动', icon: 'tabler:users', key: 'club', description: '社团联谊，活动共享。' },
  { name: '实习就业', icon: 'tabler:briefcase', key: 'internship', description: '梦想职路，共创未来。' },
  { name: '期末资料', icon: 'tabler:file-text', key: 'materials', description: '资料共享，备考互助。' },
  { name: '宿舍生活', icon: 'tabler:home', key: 'dormitory', description: '同窗共处，生活点滴。' },
  { name: '技术分享', icon: 'tabler:code', key: 'tech', description: '代码实践，技术交流。' },
  { name: '课程专区', icon: 'tabler:book', key: 'course', description: '课程内容，分享交流。' },
  { name: '组团捞人', icon: 'tabler:user-plus', key: 'team-up', description: '组队拼人，结伴同行。' },
  { name: '其他', icon: 'tabler:dots', key: 'misc', description: '畅所欲言，创意无限。' },
]

/** 发帖可选分区（含主页） */
export const POST_PARTITION_OPTIONS = ['主页', ...CONTENT_PARTITIONS.map(p => p.name)] as const
