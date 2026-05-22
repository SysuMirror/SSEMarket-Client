import type { ProductCreatePayload } from './types'
import { requestFunc } from '../req'

export async function createShopProduct(
  userID: number,
  product: ProductCreatePayload,
  syncFeedPost = true,
): Promise<number | null> {
  try {
    const res = await requestFunc('/auth/postProduct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        UserID: userID,
        Price: Math.round(product.price),
        Title: product.name.trim(),
        Content: product.description.trim(),
        Photos: product.images,
        ISAnonymous: product.isAnonymous ?? false,
        syncFeedPost,
      },
    }, true)
    if (!res?.ok)
      return null
    const data = await res.json() as { code?: number, data?: { ProductID?: number }, ProductID?: number }
    if (data.code !== undefined && data.code !== 200)
      return null
    const id = data.data?.ProductID ?? data.ProductID
    return typeof id === 'number' ? id : null
  }
  catch (e) {
    console.error(e)
    return null
  }
}

export async function deleteShopProduct(productID: number): Promise<boolean> {
  try {
    const res = await requestFunc('/auth/deleteProduct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { productID },
    }, true)
    if (!res?.ok)
      return false
    const data = await res.json() as { code?: number }
    return data.code === undefined || data.code === 200
  }
  catch (e) {
    console.error(e)
    return false
  }
}

export async function markShopProductSold(productID: number): Promise<boolean> {
  try {
    const res = await requestFunc('/auth/saleProduct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { productID },
    }, true)
    if (!res?.ok)
      return false
    const data = await res.json() as { code?: number }
    return data.code === undefined || data.code === 200
  }
  catch (e) {
    console.error(e)
    return false
  }
}
