import type { Post } from '@/types/post'

export interface RagSearchResult {
  post_id: number
  title: string
  partition: string
  tag: string
  snippet: string
  source: string
  mysql_score: number
  vector_score: number
  heat_score: number
  score: number
  intent_coverage: number
  reason: string
  post?: Post
}

export interface RagSearchData {
  query: string
  keywords: string[]
  analysis_source: string
  mysql_hits: number
  qdrant_hits: number
  results: RagSearchResult[]
  suggestions?: string[]
}

export interface RagSearchResponse {
  ok: boolean
  data?: RagSearchData
  error?: string
  cache_hit?: boolean
  cache_age_ms?: number
  elapsed_ms?: number
  timings?: {
    rag_ms?: number
    post_join_ms?: number
    total_ms?: number
  }
}

export interface HotQuery {
  query: string
  count: number
  last_seen: number
  recommend_score: number
}

export interface HotQueriesResponse {
  ok: boolean
  data?: HotQuery[]
  error?: string
}

const ragProxyBase = import.meta.env.VITE_RAG_PROXY_BASE || '/api/rag-local'

export async function searchRagPosts(query: string, limit = 5): Promise<RagSearchResponse> {
  const url = `${ragProxyBase}/search?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(limit)}`
  const res = await fetch(url)
  const data = await res.json() as RagSearchResponse
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `复合检索失败：${res.status}`)
  }
  return data
}

export async function fetchHotQueries(limit = 8): Promise<HotQuery[]> {
  const url = `${ragProxyBase}/hot-queries?limit=${encodeURIComponent(limit)}`
  const res = await fetch(url)
  const data = await res.json() as HotQueriesResponse
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `热词获取失败：${res.status}`)
  }
  return data.data || []
}
