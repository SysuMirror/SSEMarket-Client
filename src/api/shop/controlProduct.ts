import { deleteShopProduct, markShopProductSold } from './mutations'

export async function deleteProduct(productID: number): Promise<boolean> {
  return deleteShopProduct(productID)
}

export async function saleProduct(productID: number): Promise<boolean> {
  return markShopProductSold(productID)
}
