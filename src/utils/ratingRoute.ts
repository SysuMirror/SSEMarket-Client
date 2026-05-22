/** 打分专区列表 URL，带可选分区筛选 */
export function ratingZonePath(categoryID?: number) {
  if (categoryID && categoryID > 0)
    return { path: '/rating', query: { category: String(categoryID) } }
  return { path: '/rating' }
}
