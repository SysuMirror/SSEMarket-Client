/** 测量固定顶栏实际高度 */
export function getLayoutHeaderOffset(): number {
  const stack = document.querySelector('.site-header-stack')
  if (stack) {
    const h = stack.getBoundingClientRect().height
    if (h > 0)
      return h
  }
  return 92
}

function findScrollParent(el: HTMLElement): HTMLElement {
  let parent = el.parentElement
  while (parent) {
    if (
      parent.classList.contains('content')
      && !parent.classList.contains('content--layout-fill')
      && parent.closest('.app-main')
    ) {
      return parent
    }
    if (parent.classList.contains('app-main'))
      return parent
    const style = getComputedStyle(parent)
    const scrollable = /auto|scroll|overlay/.test(style.overflowY)
    if (scrollable && parent.scrollHeight > parent.clientHeight + 1)
      return parent
    parent = parent.parentElement
  }
  return document.documentElement
}

/** 将元素滚入可视区，并避开固定顶栏 */
export function scrollElementBelowHeader(
  el: HTMLElement,
  options?: { behavior?: ScrollBehavior, extraGap?: number },
) {
  const extraGap = options?.extraGap ?? 10
  const headerH = getLayoutHeaderOffset()
  const behavior = options?.behavior ?? 'smooth'
  const scrollParent = findScrollParent(el)

  if (scrollParent === document.documentElement || scrollParent === document.body) {
    const rect = el.getBoundingClientRect()
    const top = window.scrollY + rect.top - headerH - extraGap
    window.scrollTo({ top: Math.max(0, top), behavior })
    return
  }

  const parentRect = scrollParent.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const targetTop = elRect.top - parentRect.top + scrollParent.scrollTop - extraGap
  scrollParent.scrollTo({ top: Math.max(0, targetTop), behavior })
}
