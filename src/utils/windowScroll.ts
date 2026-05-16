/** 读取当前窗口纵向滚动（兼容 documentElement / body） */
export function getWindowScrollY(): number {
  return (
    window.scrollY
    ?? document.documentElement?.scrollTop
    ?? document.body?.scrollTop
    ?? 0
  )
}

/** 设置窗口纵向滚动（同时写 documentElement 与 body，避免错位） */
export function setWindowScrollY(y: number): void {
  const top = Math.max(0, y)
  window.scrollTo(0, top)
  if (document.documentElement)
    document.documentElement.scrollTop = top
  if (document.body)
    document.body.scrollTop = top
}
