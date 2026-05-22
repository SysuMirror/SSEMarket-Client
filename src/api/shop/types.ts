export interface ShopProduct {
  SellerID: number
  ProductID: number
  Seller: string
  Price: number
  Name: string
  Description: string
  Photos: string[]
  ISSold: boolean
  ISAnonymous: boolean
  PostTime?: string
}

export type Product = ShopProduct
export type ProductDetail = ShopProduct

export interface ProductCreatePayload {
  name: string
  price: number
  description: string
  images: string[]
  isAnonymous?: boolean
}

export type ShopBrowseSort = 'home' | 'history'
