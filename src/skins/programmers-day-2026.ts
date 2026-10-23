import type { SkinDefinition } from './types'

/**
 * 2026 程序员节限定皮肤。
 *
 * 素材来源：/home/cloud/imgs（2026-10-23）：
 * - 入口画面（手机）：手机入口画面1（竖版 941×1672）
 * - 背景（手机）：手机入口画面2（竖版 1024×1536）
 * - 入口画面 + 背景（电脑）：电脑入口画面（横版 1672×941）
 * - 1~12 号贴纸：同一角色的表情包，含义见下方 label/note
 *
 * 所有图片统一导出为 WebP q90（体积约为原 PNG 的 1/15，避免手机端入场
 * 等 2MB 图片）。替换素材时保持同名同比例即可，页面用 object-fit: cover
 * 展示，不会拉伸变形。
 */
const stickers = [
  { id: 'grumpy', file: 'stickers/01.webp', label: '气鼓鼓', note: 'Bug 怎么又回来了' },
  { id: 'surrender', file: 'stickers/02.webp', label: '举手投降', note: '这需求做不了' },
  { id: 'shock', file: 'stickers/03.webp', label: '震惊', note: '产品经理又改需求了' },
  { id: 'fired-up', file: 'stickers/04.webp', label: '握拳', note: '今天必须上线' },
  { id: 'giggle', file: 'stickers/05.webp', label: '偷笑', note: '代码一次跑通' },
  { id: 'cpu-burn', file: 'stickers/06.webp', label: '混乱', note: 'CPU 已烧' },
  { id: 'selfie', file: 'stickers/07.webp', label: '自拍', note: '记录第 100 次提交' },
  { id: 'heart', file: 'stickers/08.webp', label: '比心', note: '谢谢你的 Star' },
  { id: 'why', file: 'stickers/09.webp', label: '疑惑', note: '为什么本地能跑' },
  { id: 'sleepy', file: 'stickers/10.webp', label: '困倦', note: '再改一行就睡' },
  { id: 'lgtm', file: 'stickers/11.webp', label: '点赞', note: 'LGTM' },
  { id: 'yay', file: 'stickers/12.webp', label: '欢呼', note: '下班！' },
] as const

const programmersDay2026: SkinDefinition = {
  id: 'programmers-day-2026',
  name: '2026 程序员节',
  description: '致敬每一位用代码创造更好世界的你',
  splash: {
    mobile: 'splash-mobile.webp',
    desktop: 'splash-desktop.webp',
  },
  background: {
    mobile: 'bg-mobile.webp',
    desktop: 'bg-desktop.webp',
  },
  stickers: [...stickers],
}

export default programmersDay2026
