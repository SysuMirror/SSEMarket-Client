import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { setWindowScrollY } from '@/utils/windowScroll'

/** 信息流主页（底栏「主页」对应的路由） */
export function isHomeFeedRoute(route: RouteLocationNormalizedLoaded): boolean {
  return route.name === 'Home' || route.path === '/'
}

/** 已在主页时再次点「主页」：滚到顶部 */
export function handleHomeNavClick(
  e: MouseEvent,
  route: RouteLocationNormalizedLoaded,
): void {
  if (!isHomeFeedRoute(route))
    return
  e.preventDefault()
  setWindowScrollY(0)
}
