import { showSnackbar } from '@/utils/snackbar'

/**
 * 全局提示条（toast）。
 *
 * 以前这里每条消息都 createApp 挂一个 Vue 应用，样式是右上角一大块
 * 20%×30% 的灰色模糊玻璃，6 秒才散，多条还会重叠在同一个点上。
 * 现在薄薄一层，转发给 src/utils/snackbar.ts 的 SnackbarManager：
 * 小尺寸、按位置堆叠、同文案自动合并，视觉与 snackbar 共用 src/assets/snackbar.css。
 *
 * 调用点约 280 处、3 种 import 路径，所以导出名与文件路径都保持不变；
 * 第二个参数是新增的可选类型，老调用（只传字符串）不受影响。
 */
export type MsgType = 'info' | 'success' | 'error' | 'warning'

const MOBILE_QUERY = '(max-width: 768px)'

const DURATION: Record<MsgType, number> = {
  info: 2600,
  success: 2600,
  warning: 3200,
  error: 4000,
}

function isMobile() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
}

export function showMsg(msg: string, type: MsgType = 'info') {
  showSnackbar({
    message: msg,
    type,
    // 电脑端顶部居中（不压导航），手机端底部（让开底栏）
    position: isMobile() ? 'bottom' : 'top',
    duration: DURATION[type],
    // 同文案的并发提示（例如同时几个 401 都报「登录过期」）合并成一条
    id: `msg:${type}:${msg}`,
  })
}
