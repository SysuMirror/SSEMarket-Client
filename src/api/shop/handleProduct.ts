import type { ProductCreatePayload } from './types'
import { createShopProduct } from './mutations'

export type ProductCreation = ProductCreatePayload

export async function handleProduct(product: ProductCreatePayload, userID: number): Promise<number | null> {
  return createShopProduct(userID, product)
}
