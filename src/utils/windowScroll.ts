/** 主布局滚动容器（常规页为 .content，layoutFill 页为 .app-main） */
export function getAppMainScrollContainer(): HTMLElement | null {
  const layoutFill = document.querySelector('.app-main > .content.content--layout-fill')
  if (layoutFill)
    return document.querySelector('.app-main')

  return (
    document.querySelector('.app-main > .content:not(.content--layout-fill)')
    ?? document.querySelector('.app-main')
  )
}

/** 读取当前纵向滚动（优先 .app-main，兼容旧版 window/body 滚动） */
export function getWindowScrollY(): number {
  const main = getAppMainScrollContainer()
  if (main)
    return main.scrollTop

  return (
    window.scrollY
    ?? document.documentElement?.scrollTop
    ?? document.body?.scrollTop
    ?? 0
  )
}

/** 设置纵向滚动（优先 .app-main） */
export function setWindowScrollY(y: number): void {
  const top = Math.max(0, y)
  const main = getAppMainScrollContainer()
  if (main) {
    main.scrollTop = top
    return
  }

  window.scrollTo(0, top)
  if (document.documentElement)
    document.documentElement.scrollTop = top
  if (document.body)
    document.body.scrollTop = top
}
