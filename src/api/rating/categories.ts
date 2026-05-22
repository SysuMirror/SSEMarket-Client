import type { RatingCategory } from './types'
import { requestFunc } from '../req'

export async function getRatingCategories(): Promise<RatingCategory[]> {
  try {
    const res = await requestFunc('/auth/rating/category/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {},
    }, true)
    if (!res?.ok)
      return []
    return await res.json() as RatingCategory[]
  }
  catch (e) {
    console.error(e)
    return []
  }
}

export async function createRatingCategory(
  name: string,
  description = '',
  syncFeedPost = true,
): Promise<RatingCategory | null> {
  try {
    const res = await requestFunc('/auth/rating/category/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { name, description, syncFeedPost },
    }, true)
    if (!res?.ok)
      return null
    return await res.json() as RatingCategory
  }
  catch (e) {
    console.error(e)
    return null
  }
}
