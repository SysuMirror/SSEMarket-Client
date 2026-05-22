import { requestFunc } from '../req'

export async function submitRatingStar(ratingPostID: number, starNum: number): Promise<boolean> {
  try {
    const res = await requestFunc('/auth/rating/star/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { ratingPostID, starNum },
    }, true)
    return !!res?.ok
  }
  catch (e) {
    console.error(e)
    return false
  }
}
