import type { ProductDetail, ShopBrowseSort, ShopProduct } from './types'
import { requestFunc } from '../req'

function normalizeProduct(raw: Record<string, unknown>): ShopProduct {
  const photos = raw.Photos ?? raw.photos
  return {
    SellerID: Number(raw.SellerID ?? raw.sellerID ?? 0),
    ProductID: Number(raw.ProductID ?? raw.productID ?? 0),
    Seller: String(raw.Seller ?? raw.seller ?? ''),
    Price: Number(raw.Price ?? raw.price ?? 0),
    Name: String(raw.Name ?? raw.name ?? ''),
    Description: String(raw.Description ?? raw.description ?? ''),
    Photos: Array.isArray(photos) ? photos.map(String) : [],
    ISSold: Boolean(raw.ISSold ?? raw.isSold ?? false),
    ISAnonymous: Boolean(raw.ISAnonymous ?? raw.isAnonymous ?? false),
    PostTime: raw.PostTime != null ? String(raw.PostTime) : undefined,
  }
}

export type GetShopProductsOptions = {
  searchsort: ShopBrowseSort
  searchinfo?: string
  limit?: number
  offset?: number
}

export async function getShopProducts(
  searchsortOrOpts: ShopBrowseSort | GetShopProductsOptions,
  searchinfo = '',
  limit = 1000,
  offset = 0,
): Promise<ShopProduct[]> {
  let searchsort: ShopBrowseSort
  let si = searchinfo
  let lim = limit
  let off = offset
  if (typeof searchsortOrOpts === 'object') {
    searchsort = searchsortOrOpts.searchsort
    si = searchsortOrOpts.searchinfo ?? ''
    lim = searchsortOrOpts.limit ?? 1000
    off = searchsortOrOpts.offset ?? 0
  }
  else {
    searchsort = searchsortOrOpts
  }
  try {
    const res = await requestFunc('/auth/getProducts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { searchinfo: si, searchsort, limit: lim, offset: off },
    }, true)
    if (!res?.ok)
      return []
    const raw = await res.json()
    if (!Array.isArray(raw))
      return []
    return raw.map((row: Record<string, unknown>) => normalizeProduct(row))
  }
  catch (e) {
    console.error(e)
    return []
  }
}

export async function getProducts(searchsort: ShopBrowseSort): Promise<ShopProduct[]> {
  return getShopProducts(searchsort)
}

export async function getShopProductDetail(productID: number): Promise<ProductDetail | null> {
  try {
    const res = await requestFunc('/auth/getProductDetail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { productID },
    }, true)
    if (!res?.ok)
      return null
    const raw = await res.json() as Record<string, unknown>
    return normalizeProduct(raw)
  }
  catch (e) {
    console.error(e)
    return null
  }
}

export async function getProductByID(id: number): Promise<ProductDetail> {
  const p = await getShopProductDetail(id)
  if (p)
    return p
  return {
    SellerID: 0,
    ProductID: 0,
    Seller: '',
    Price: 0,
    Name: '',
    Description: '',
    Photos: [],
    ISSold: false,
    ISAnonymous: false,
  }
}

export async function getShopProductCount(
  searchsort: ShopBrowseSort,
  searchinfo = '',
  userID = 0,
): Promise<number> {
  try {
    const res = await requestFunc('/auth/getProductNum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { searchinfo, searchsort, UserID: userID, limit: 0, offset: 0 },
    }, true)
    if (!res?.ok)
      return 0
    const data = await res.json() as { Productcount?: number }
    return Number(data.Productcount ?? 0)
  }
  catch (e) {
    console.error(e)
    return 0
  }
}

/** 轮播：优先用在售商品图，不足时用默认封面 */
export async function getShopCarousel(): Promise<string[]> {
  const products = await getShopProducts('home', '', 12, 0)
  const urls: string[] = []
  for (const p of products) {
    for (const url of p.Photos) {
      if (url && !urls.includes(url))
        urls.push(url)
      if (urls.length >= 6)
        return urls
    }
  }
  return urls
}
