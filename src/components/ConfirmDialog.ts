import '@/assets/ConfirmDialog.css'

/**
 * 自绘确认框，替代浏览器原生 window.confirm()。
 *
 * 原生框的标题、按钮文案、配色都由浏览器决定，和整站风格脱节，手机上还特别突兀。
 * 这里是一张 B 站式的小卡：窄、居中、留白紧、进出动画短。
 *
 * 用法：
 *   if (!await confirmDialog({ message: '确定删除这条评分？', danger: true })) return
 *
 * 取消途径：取消按钮 / Esc / 点遮罩 —— 都 resolve(false)；确定按钮 / Enter —— resolve(true)。
 */
export interface ConfirmOptions {
  /** 可选标题；不传就只有一段正文 */
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  /** 删除 / 吊销这类不可恢复的操作：主按钮红色 */
  danger?: boolean
}

/** 同时只保留一个确认框：后开的把前一个按取消处理 */
let current: (() => void) | null = null

function getScrollbarWidth() {
  const probe = document.createElement('div')
  probe.style.cssText = 'width:100px;height:100px;overflow:scroll;position:absolute;top:-9999px;'
  document.body.appendChild(probe)
  const width = probe.offsetWidth - probe.clientWidth
  document.body.removeChild(probe)
  return width
}

export function confirmDialog(options: ConfirmOptions | string): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options

  // 已有确认框没关就再开一个：旧的按「取消」收掉，避免两层遮罩叠在一起
  current?.()

  return new Promise((resolve) => {
    const mask = document.createElement('div')
    mask.className = 'cdlg-mask'

    const box = document.createElement('div')
    box.className = 'cdlg'
    box.setAttribute('role', 'dialog')
    box.setAttribute('aria-modal', 'true')
    box.setAttribute('tabindex', '-1')

    const titleId = 'cdlg-title'
    const msgId = 'cdlg-msg'
    box.setAttribute('aria-labelledby', titleId)
    box.setAttribute('aria-describedby', msgId)

    if (opts.title) {
      const title = document.createElement('h3')
      title.id = titleId
      title.className = 'cdlg__title'
      title.textContent = opts.title
      box.appendChild(title)
    }

    const msg = document.createElement('p')
    msg.id = msgId
    msg.className = 'cdlg__msg'
    msg.textContent = opts.message
    box.appendChild(msg)

    const btns = document.createElement('div')
    btns.className = 'cdlg__btns'

    const cancelBtn = document.createElement('button')
    cancelBtn.type = 'button'
    cancelBtn.className = 'cdlg__btn cdlg__btn--cancel'
    cancelBtn.textContent = opts.cancelText || '取消'

    const okBtn = document.createElement('button')
    okBtn.type = 'button'
    okBtn.className = `cdlg__btn cdlg__btn--ok${opts.danger ? ' cdlg__btn--danger' : ''}`
    okBtn.textContent = opts.confirmText || '确定'

    btns.append(cancelBtn, okBtn)
    box.appendChild(btns)
    mask.appendChild(box)
    document.body.appendChild(mask)

    // 锁背景滚动（和 ImageShower 同一套：overflow hidden + 滚动条宽度补偿）
    const prevOverflow = document.body.style.overflow
    const prevPaddingRight = document.body.style.paddingRight
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${getScrollbarWidth()}px`

    const opener = document.activeElement as HTMLElement | null

    let done = false
    let closeId: ReturnType<typeof setTimeout> | null = null

    function finish(value: boolean) {
      if (done)
        return
      done = true
      close()
      resolve(value)
    }

    function close() {
      if (closeId)
        clearTimeout(closeId)

      document.removeEventListener('keydown', onKeydown, true)
      mask.removeEventListener('click', onMaskClick)
      cancelBtn.removeEventListener('click', onCancel)
      okBtn.removeEventListener('click', onOk)
      current = null

      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPaddingRight

      mask.classList.add('cdlg-mask--out')
      closeId = setTimeout(() => mask.remove(), 160)

      // 焦点还给触发确认框的那个元素
      if (opener && document.contains(opener))
        opener.focus()
    }

    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        finish(false)
        return
      }
      if (e.key === 'Enter') {
        // 焦点在取消按钮上时，Enter 应该走取消而不是确定
        if (e.target === cancelBtn)
          return
        e.preventDefault()
        finish(true)
        return
      }
      if (e.key === 'Tab') {
        // 只有两个可聚焦控件，来回循环即可
        e.preventDefault()
        const next = (e.shiftKey || e.target === okBtn) ? cancelBtn : okBtn
        next.focus()
      }
    }

    function onMaskClick(e: MouseEvent) {
      if (e.target === mask)
        finish(false)
    }

    function onCancel() {
      finish(false)
    }

    function onOk() {
      finish(true)
    }

    document.addEventListener('keydown', onKeydown, true)
    mask.addEventListener('click', onMaskClick)
    cancelBtn.addEventListener('click', onCancel)
    okBtn.addEventListener('click', onOk)

    current = () => finish(false)

    requestAnimationFrame(() => okBtn.focus())
  })
}
