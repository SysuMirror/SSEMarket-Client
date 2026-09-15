/**
 * 仅对文本输入类元素（input 文本类、textarea、contenteditable）触发的 focusin/focusout 事件处理器
 * 用于避免多选框、按钮等元素触发全局焦点逻辑
 */
export function setupFocusHandlers(
  onGlobalFocus: (event: FocusEvent) => void,
  onGlobalBlur: (event: FocusEvent) => void,
) {
  // 辅助函数：判断是否为文本输入元素（排除 checkbox/radio/button 等非键盘输入型 input）
  function isInputElement(el: EventTarget | null): boolean {
    if (!el || !(el instanceof Element))
      return false

    if (el.tagName === 'TEXTAREA' || (el instanceof HTMLElement && el.isContentEditable))
      return true

    if (el instanceof HTMLInputElement)
      return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'image', 'range', 'color'].includes(el.type)

    return false
  }

  /**
   * iOS Safari：聚焦 fixed 顶栏内的输入框时，浏览器会无视 body overflow:hidden
   * 强制滚动文档以露出键盘上方的输入框（WebKit 153852 家族行为），失焦后并不还原，
   * 表现为页面卡在偏移位置、手势滑不动。失焦时把文档滚动归零即可恢复。
   */
  function resetDocumentScroll() {
    window.scrollTo(0, 0)
    // 老 iOS 上 documentElement/body 谁是滚动容器不确定，双保险
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }

  // 事件处理：仅输入框触发
  const handleFocusIn = (e: FocusEvent) => {
    if (isInputElement(e.target)) {
      onGlobalFocus(e)
    }
  }

  const handleFocusOut = (e: FocusEvent) => {
    if (isInputElement(e.target)) {
      onGlobalBlur(e)
      resetDocumentScroll()
    }
  }

  // 绑定全局事件
  window.addEventListener('focusin', handleFocusIn)
  window.addEventListener('focusout', handleFocusOut)

  // 返回清理函数，便于后续移除监听
  return () => {
    window.removeEventListener('focusin', handleFocusIn)
    window.removeEventListener('focusout', handleFocusOut)
  }
}
