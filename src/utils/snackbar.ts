import '@/assets/snackbar.css'

export interface SnackbarOptions {
  message: string
  actionText?: string
  duration?: number
  position?: 'top' | 'bottom'
  type?: 'success' | 'error' | 'info' | 'warning'
  onAction?: () => void
  onClose?: () => void
  id?: string
  alwaysShow?: boolean
}

export interface SnackbarInstance {
  show: () => void
  hide: () => void
  destroy: () => void
  updateMessage: (message: string) => void
  id?: string
}

/** 进出动画时长，需与 snackbar.css 里的 transition 时长一致 */
const ANIM_MS = 200

/** 同一位置最多同时显示几条 */
const MAX_STACK = 4

type Position = 'top' | 'bottom'

/**
 * 两个层级：
 * - toast（一次性提示，showMsg 走这档）z-index 4000，必须浮在一切覆盖层之上；
 * - notice（alwaysShow 的常驻通知，比如「有新帖子」）z-index 1000，
 *   保持改造前的层级 —— 别在全屏阅读器 / 播放器之上还杵在那儿。
 */
type Tier = 'toast' | 'notice'

class SnackbarManager {
  private instances: Map<string, SnackbarInstance> = new Map()
  private containers: Map<string, HTMLElement> = new Map()
  private isDestroyed = false

  /**
   * 每个「层级 × 位置」一个流式容器（flex 列），条目按顺序排布 —— 之前每条 snackbar 各自
   * position:fixed; left:50%，多条同时出现会完全重叠在同一个点上。
   */
  private getContainer(position: Position, tier: Tier): HTMLElement {
    const key = `${tier}:${position}`
    const existing = this.containers.get(key)
    if (existing)
      return existing

    const container = document.createElement('div')
    container.className = `snackbar-container snackbar-container--${position} snackbar-container--${tier}`
    container.setAttribute('aria-live', 'polite')
    container.setAttribute('aria-atomic', 'false')
    document.body.appendChild(container)
    this.containers.set(key, container)
    return container
  }

  private createSnackbar(options: SnackbarOptions): SnackbarInstance {
    const id = options.id || Math.random().toString(36).slice(2, 11)
    const position = options.position || 'bottom'
    const container = this.getContainer(position, options.alwaysShow ? 'notice' : 'toast')

    const snackbar = document.createElement('div')
    // 以「未入场」状态入 DOM：否则从 append 到第一帧 rAF 之间会有一帧全亮闪烁
    snackbar.className = `snackbar snackbar--${position} snackbar--${options.type || 'info'} snackbar--enter`
    snackbar.setAttribute('role', options.type === 'error' ? 'alert' : 'status')

    const content = document.createElement('div')
    content.className = 'snackbar-content'

    const message = document.createElement('span')
    message.className = 'snackbar-message'
    message.textContent = options.message
    content.appendChild(message)

    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let leaveId: ReturnType<typeof setTimeout> | null = null

    const instance: SnackbarInstance = {
      id,

      show: () => {
        // 重入（同 id 再次 show）：先掐掉上一轮的隐藏定时器，
        // 否则旧定时器会在 toast 刚复活时把它收掉
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        if (leaveId) {
          clearTimeout(leaveId)
          leaveId = null
        }

        snackbar.classList.remove('snackbar--leave')
        snackbar.classList.add('snackbar--enter')

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            snackbar.classList.remove('snackbar--enter')
            snackbar.classList.add('snackbar--entered')
          })
        })

        // 自动隐藏（alwaysShow 时忽略 duration）
        if (!options.alwaysShow && options.duration && options.duration > 0) {
          timeoutId = setTimeout(() => instance.hide(), options.duration)
        }
      },

      hide: () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }

        snackbar.classList.remove('snackbar--enter', 'snackbar--entered')
        snackbar.classList.add('snackbar--leave')

        leaveId = setTimeout(() => instance.destroy(), ANIM_MS)
      },

      destroy: () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        if (leaveId) {
          clearTimeout(leaveId)
          leaveId = null
        }
        if (snackbar.parentNode)
          snackbar.parentNode.removeChild(snackbar)
        this.instances.delete(id)
      },

      updateMessage: (newMessage: string) => {
        message.textContent = newMessage
      },
    }

    if (options.actionText) {
      const actionButton = document.createElement('button')
      actionButton.type = 'button'
      actionButton.className = 'snackbar-action'
      actionButton.textContent = options.actionText
      actionButton.addEventListener('click', () => {
        options.onAction?.()
        // alwaysShow 的 snackbar 点击后直接销毁，否则走隐藏动画
        if (options.alwaysShow)
          instance.destroy()
        else
          instance.hide()
      })
      content.appendChild(actionButton)
    }

    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'snackbar-close'
    closeButton.setAttribute('aria-label', '关闭提示')
    closeButton.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `
    closeButton.addEventListener('click', () => {
      options.onClose?.()
      if (options.alwaysShow)
        instance.destroy()
      else
        instance.hide()
    })

    snackbar.appendChild(content)
    snackbar.appendChild(closeButton)
    snackbar.dataset.snackbarId = id
    container.appendChild(snackbar)

    this.instances.set(id, instance)

    // 堆叠上限：连点受限操作时别堆成塔，超出就摘掉最旧的一条
    while (container.children.length > MAX_STACK) {
      const oldest = container.firstElementChild as HTMLElement | null
      if (!oldest || oldest === snackbar)
        break
      const stale = this.instances.get(oldest.dataset.snackbarId || '')
      if (stale)
        stale.destroy()
      else
        oldest.remove()
    }

    return instance
  }

  show(options: SnackbarOptions): SnackbarInstance {
    if (this.isDestroyed)
      throw new Error('SnackbarManager has been destroyed')

    // 指定了 id 就复用同一条：只换文案并重置计时，不新增一行
    if (options.id) {
      const existingInstance = this.instances.get(options.id)
      if (existingInstance) {
        existingInstance.updateMessage(options.message)
        existingInstance.show()
        return existingInstance
      }
    }

    const instance = this.createSnackbar(options)
    instance.show()
    return instance
  }

  // 封装了常用的几个函数
  success(message: string, actionText?: string, onAction?: () => void): SnackbarInstance {
    return this.show({
      message,
      actionText,
      type: 'success',
      duration: 2600,
      position: 'bottom',
      onAction,
    })
  }

  error(message: string, actionText?: string, onAction?: () => void): SnackbarInstance {
    return this.show({
      message,
      actionText,
      type: 'error',
      duration: 4000,
      position: 'top',
      onAction,
    })
  }

  info(message: string, actionText?: string, onAction?: () => void): SnackbarInstance {
    return this.show({
      message,
      actionText,
      type: 'info',
      duration: 2600,
      position: 'bottom',
      onAction,
    })
  }

  warning(message: string, actionText?: string, onAction?: () => void): SnackbarInstance {
    return this.show({
      message,
      actionText,
      type: 'warning',
      duration: 3200,
      position: 'top',
      onAction,
    })
  }

  hide(id: string): void {
    this.instances.get(id)?.hide()
  }

  destroy(): void {
    for (const instance of this.instances.values())
      instance.destroy()
    for (const container of this.containers.values()) {
      if (container.parentNode)
        container.parentNode.removeChild(container)
    }
    this.containers.clear()
    this.isDestroyed = true
  }
}

// 创建全局实例
const snackbar = new SnackbarManager()

/**
 * @description 显示snackbar
 * @param {SnackbarOptions} options snackbar配置选项
 */
export function showSnackbar(options: SnackbarOptions): SnackbarInstance {
  return snackbar.show(options)
}

/** 按 id 收起一条 snackbar（常驻通知切模式时用）。 */
export function hideSnackbar(id: string): void {
  snackbar.hide(id)
}

/**
 * @description 显示成功提示
 * @param {string} message 提示消息
 * @param {string} actionText 操作按钮文字
 * @param {Function} onAction 操作回调
 */
export function showSuccess(message: string, actionText?: string, onAction?: () => void): SnackbarInstance {
  return snackbar.success(message, actionText, onAction)
}

/**
 * @description 显示错误提示
 * @param {string} message 提示消息
 * @param {string} actionText 操作按钮文字
 * @param {Function} onAction 操作回调
 */
export function showError(message: string, actionText?: string, onAction?: () => void): SnackbarInstance {
  return snackbar.error(message, actionText, onAction)
}

/**
 * @description 显示信息提示
 * @param {string} message 提示消息
 * @param {string} actionText 操作按钮文字
 * @param {Function} onAction 操作回调
 */
export function showInfo(message: string, actionText?: string, onAction?: () => void): SnackbarInstance {
  return snackbar.info(message, actionText, onAction)
}

/**
 * @description 显示警告提示
 * @param {string} message 提示消息
 * @param {string} actionText 操作按钮文字
 * @param {Function} onAction 操作回调
 */
export function showWarning(message: string, actionText?: string, onAction?: () => void): SnackbarInstance {
  return snackbar.warning(message, actionText, onAction)
}

export default {
  show: showSnackbar,
  success: showSuccess,
  error: showError,
  info: showInfo,
  warning: showWarning,
}
