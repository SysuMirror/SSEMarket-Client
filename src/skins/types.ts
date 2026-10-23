/**
 * 全站皮肤（节日皮肤）资源定义。
 *
 * 一套皮肤只描述「有哪些图、叫什么」，不包含任何时间判断或用户偏好：
 * - 活动时间窗由后端 /auth/theme/state 返回（见 domain/theme.go）；
 * - 用户选哪套皮肤、是否看开场画面/背景由 useSkin 统一管理。
 *
 * 以后换节日只需要复制一份目录 + 新的 SkinDefinition，再在后端注册时间窗。
 */

export interface SkinResponsiveImage {
  /** 手机端图片（竖版或方版），路径相对于 public/skins/<id>/ */
  mobile: string
  /** 电脑端图片（横版），路径相对于 public/skins/<id>/ */
  desktop: string
}

export interface SkinSticker {
  /** 稳定 ID，用于 key / 埋点 */
  id: string
  /** 图片路径，相对于 public/skins/<id>/ */
  file: string
  /** 一句话含义（也用作 alt） */
  label: string
  /** 可选：贴纸墙上的程序员梗说明 */
  note?: string
}

export interface SkinDefinition {
  /** 必须与后端 domain/theme.go 的 ThemeID 完全一致 */
  id: string
  /** 展示名 */
  name: string
  /** 一句话简介 */
  description: string
  /** 开场画面（全屏，展示 3s，可跳过） */
  splash: SkinResponsiveImage
  /** 全站背景（可关闭 / 可替换为用户上传图） */
  background: SkinResponsiveImage
  /** 1~12 张节日贴纸，可用于横幅、装饰、设置页表情墙 */
  stickers: SkinSticker[]
}
